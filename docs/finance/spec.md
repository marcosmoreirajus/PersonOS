# Spec Técnica — Entrada de Dados (Módulo Finanças, PersonOS)

Complementa `docs/finance/PRD.md`. Aqui está **como** implementar: formato dos dados, regras derivadas, algoritmos e contratos de API.

## Convenção geral de dados

- Persistência continua em **JSON** sob `backend/data/`, um arquivo por entidade, lido e escrito pelo `data_service`. O modelo é desenhado para migrar a banco relacional sem redesenho (chaves inteiras, relacionamentos explícitos, nada de campo polimórfico).
- **Datas de calendário** (vencimento, competência) são `YYYY-MM-DD`, sem hora e sem fuso. **Instantes** (criação, evento) são ISO-8601 com `Z`. Toda leitura de data de calendário na UI usa `timeZone: 'UTC'` — ver o padrão já registrado sobre meia-noite UTC aparecendo um dia antes no Brasil.
- **Dinheiro** é `float` no MVP (como hoje). Ao migrar para banco, vira decimal — nenhum cálculo pode depender de arredondamento de float.
- Campo ausente e campo `null` significam a mesma coisa: **não sei**. Nunca usar `0`, `""` ou uma categoria guarda-chuva para representar ausência.

## Entidade `transaction`

Arquivo: `backend/data/transactions.json`.

```jsonc
{
  "id": 1,
  "user_id": 1,
  "type": "expense",                    // expense | income
  "amount": 45.50,
  "description": "Supermercado - compras da semana",
  "category_id": 1,                     // null = Sem categoria (ver "Balde virtual")
  "due_date": "2026-09-10",             // quando vence / quando era esperado
  "settled_at": "2026-09-10",           // NULL até o dinheiro se mover  ← campo-chave
  "account_id": 1,                      // conta genérica (entidade mínima)
  "is_internal_transfer": false,        // true = fora de receita/despesa/relatórios
  "needs_transfer_review": false,       // único sinal de pendência gravado
  "series_id": null,                    // FK para series.json
  "series_index": null,                 // 6 em "6 de 12"; null em recorrência
  "ingest_state": "confirmed",          // confirmed | awaiting_reconciliation
  "source": "manual",                   // manual | ai | import | open_finance
  "external_id": null,                  // FITID do OFX, quando houver
  "import_hash": null,                  // hash da linha de origem
  "history": [],                        // ver "Histórico de eventos"
  "created_at": "2026-09-10T14:30:00Z"
}
```

### Campos que saíram de `scheduled.json`

`nature`, `frequency` e `installment` **não** viram campos da transação — migram para a entidade `series`. `card_invoice` continua como marcador visual até o módulo Cartões existir. `name` vira `description`. `value` vira `amount`. `status` **desaparece** (ver abaixo).

### Estado de vida: derivado, nunca gravado

`previsto / atrasado / realizado` não é campo. É calculado de `settled_at` + `due_date` + hoje:

| `settled_at` | `due_date` | Leitura |
|---|---|---|
| preenchido | qualquer | **realizado** |
| null | no futuro | **previsto** |
| null | no passado | **atrasado** |

Derivar apenas do calendário está **errado** e foi explicitamente rejeitado: uma conta vencida e não paga seria lida como realizada e entraria no saldo.

Linha importada de extrato nasce com `settled_at` preenchido — o banco só informa o que já aconteceu.

### Estado de ingestão: gravado, e num eixo separado

`ingest_state` existe porque "vai acontecer × aconteceu" e "é confiável × está em análise" são perguntas diferentes: uma parcela futura suspeita de duplicidade é as duas coisas ao mesmo tempo. Empilhar as duas num campo só forçaria descartar uma.

**Regra inegociável:** todo endpoint de leitura agregada — saldo, dashboard, relatórios, listagem padrão de transações, exportação — filtra `ingest_state == "confirmed"`. O único lugar que enxerga `awaiting_reconciliation` é a tela "A revisar".

### Categoria tem lado

Cada categoria carrega `type`: `expense`, `income` ou `both`. O formulário de lançamento só oferece as que se aplicam ao tipo escolhido, e trocar entrada/saída **limpa** a categoria que deixou de valer — manter uma que não pertence ao novo tipo gravaria o par errado em silêncio.

`both` existe para o guarda-chuva ("Outros"), que serve aos dois lados. Em operação em **lote**, seleção de um tipo só oferece as categorias dele; seleção mista oferece apenas as `both`, senão o lote gravaria "Salário" numa despesa que estava marcada junto por acaso.

### Balde virtual "Sem categoria"

`category_id = null`. **Nunca** criar uma linha "Sem categoria" em `categories.json`: ela apareceria no seletor do cadastro e a memória de classificação poderia aprender a classificá-la *como* tal, esvaziando a fila sem ninguém revisar nada. "Outros" (id 6) é escolha deliberada e continua sendo outra coisa.

Não existe campo de motivos de pendência: `sem_categoria` é derivável (`category_id IS NULL`), e o único julgamento que precisa ser gravado é `needs_transfer_review`.

### Histórico de eventos

Lista append-only no próprio registro. Eventos escolhidos, **não** diff automático de campos:

```jsonc
"history": [
  {"at": "2026-09-10T14:30:00Z", "event": "created",         "source": "import"},
  {"at": "2026-09-10T14:30:05Z", "event": "category_set",    "to": 1, "source": "ai"},
  {"at": "2026-09-12T09:00:00Z", "event": "due_date_moved",  "from": "2026-09-10", "to": "2026-10-10"},
  {"at": "2026-09-12T09:02:00Z", "event": "amount_changed",  "from": 45.50, "to": 47.00},
  {"at": "2026-09-13T10:00:00Z", "event": "reconciled_with", "transaction_id": 88},
  {"at": "2026-09-13T10:00:00Z", "event": "settled",         "on": "2026-09-13"}
]
```

`created` carrega a origem — "origem" não é um evento próprio, porque nunca muda. `settled` é um evento só, rotulado na UI conforme a natureza: **Pago** em despesa, **Recebido** em receita.

## Entidade `series`

Arquivo novo: `backend/data/series.json`. Um mecanismo, dois sabores.

```jsonc
{
  "id": 1,
  "user_id": 1,
  "kind": "installment",          // installment | recurring
  "description": "Geladeira",
  "type": "expense",
  "category_id": 11,
  "account_id": 1,
  "amount": 250.00,               // valor VIGENTE (edições "esta e futuras" atualizam aqui)
  "frequency": "monthly",
  "anchor_day": 10,
  "start_date": "2026-09-10",
  "total_count": 24,              // installment: nº de parcelas
  "end_date": null,               // recurring: data-limite, ou null = indefinida
  "ended_at": null                // preenchido quando "excluir esta e futuras" encerra a série
}
```

O **total da dívida nunca é gravado** — é sempre `SUM(amount)` das transações da série. Se uma parcela vier com juros, o total simplesmente muda.

**Divisão do total em parcelas.** Na criação, o usuário informa o **total** e o app divide — é assim que a compra acontece ("6.000 em 24x"). O que se guarda é o valor da **parcela**, porque é ela que aparece na fatura e que a importação vai tentar casar.

A parcela é **truncada para baixo** em centavos e a **sobra vai para a primeira**, seguindo a convenção do crédito parcelado no Brasil (cartão, carnê e crediário cobram a diferença na entrada). Duas consequências pretendidas: a soma das parcelas bate **exatamente** com o total informado — obrigatório, já que o total exibido é essa soma — e a primeira parcela é sempre a **maior**, nunca a menor. Arredondar em vez de truncar quebraria a segunda: 100 em 7x daria parcela de 14,29 e primeira de 14,26, a menor de todas.

### Geração

O critério é **ter fim conhecido**, não o `kind`:

- `total_count` ou `end_date` preenchidos → **materializa tudo** até o fim (24x gera 24; financiamento de 360 gera 360). Uma recorrência com contrato até 2028 é um compromisso tão fechado quanto um parcelamento.
- Ambos nulos → **janela rolante de 12 meses**.

**Extensão da janela:** na virada do mês, na primeira vez que o app abrir. Não por cron (não há processo rodando no MVP) e não a cada carregamento de tela.

**Ausência maior que a janela:** ao estender, gerar do fim da janela antiga até hoje, e não só daqui para frente. As ocorrências recuperadas nascem com `settled_at = null` e `due_date` no passado — isto é, **atrasadas**, que é o que elas são. Ignorá-las quebraria a conciliação do período: os pagamentos chegariam sem obrigação com que casar.

**Além do horizonte:** projeção de tela, calculada da regra, sem gravar. **Leitura projeta, escrita materializa** — no instante em que o usuário edita ou exclui uma ocorrência projetada, ela (e só ela) vira registro. O calendário estende sob demanda ao navegar; mês vazio só aparece quando é vazio de verdade.

Consequência: **materialização é por série, não por mês.** Março/2028 pode conter parcela real de uma série e projeção de outra. "Esse mês está gerado?" deixa de ser pergunta respondível.

### Operações com escopo

Editar, excluir e pular fazem **a mesma pergunta**: `only_this` | `this_and_future` | `all`. Uma regra aprendida uma vez, três lugares.

O que cada uma toca:

| Operação | Ocorrências | Série (molde) |
|---|---|---|
| **Pular / adiar** | sim | **não** — a série retoma o ritmo |
| **Editar** | sim | sim — atualiza `amount`/`category_id` vigentes |
| **Excluir `this_and_future`** | sim | sim — grava `ended_at` |

Se editar e excluir não tocassem o molde, a extensão do mês seguinte regeneraria com o valor velho e faria a assinatura cancelada **voltar**. Já pular é adiamento — temporário por natureza.

**Pular** empurra `due_date` em um período. `all` numa recorrência indefinida afeta apenas os 12 meses materializados. A data anterior **não** é gravada em campo próprio: quem responde "o que houve aqui" é o evento `due_date_moved` no histórico.

**Excluir é excluir:** o registro some, sem lápide. Reimportar um arquivo que o contenha traz o registro de volta — comportamento escolhido conscientemente, priorizando previsibilidade sobre proteção.

## Importação e conciliação

### Fluxo

1. **Upload e parse** (OFX ou XLS/CSV no layout da aplicação) → lista de linhas normalizadas.
2. **Hash da linha**: `sha1(descrição normalizada + valor + data + account_id)`. Normalizar = minúsculas, sem acento, espaços colapsados.
3. **Já importada?** Se `external_id` (FITID) ou `import_hash` já existe em `transactions.json`, a linha é ignorada — reimportar não traz de novo.
4. **Suspeita de duplicidade?** Casa com transação existente por: mesmo valor **e** data dentro de ±3 dias **e** descrição com igualdade normalizada ou palavra-chave contida. Sem similaridade por limiar — casamento é determinístico.
   - **Sim** → grava com `ingest_state = "awaiting_reconciliation"` e referência ao candidato.
   - **Não** → grava com `ingest_state = "confirmed"` (entra na hora).
5. **Classificação** das linhas confirmadas: memória determinística primeiro; o que sobrar vai para a IA **em lote**; o que a IA não souber com certeza fica `category_id = null`.
6. **Resumo**: importadas, já existentes, aguardando conciliação, e classificadas **separando memória × IA** — é esse número que comprova a queda de dependência de IA mês a mês.

### Decisões de implementação (Fatia 3, 23/09)

O fluxo acima deixava pontos em aberto. Como foram resolvidos, e por quê:

1. **O hash leva um contador de ocorrência.** `sha1(descrição + valor + tipo + data + conta + "#n")`, onde `n` é a ordem da mesma base dentro do arquivo. Dois cafés de R$ 8 no mesmo dia geram a mesma base; sem o contador a segunda linha seria descartada como "já importada". Reimportar continua idempotente.
2. **FITID é a identidade quando existe.** O banco dizendo que duas linhas têm FITIDs diferentes é a palavra final: o hash não pode contradizê-lo. O hash só vale contra registros que vieram **sem** FITID (CSV, digitado). `external_id` é `"<ACCTID>:<FITID>"`.
3. **Candidato a duplicata é quem não tem FITID** — digitado à mão, gerado por série ou importado de CSV. Compra igual vinda do banco com outro FITID não é candidata. Isso inclui a ocorrência **prevista** de uma série: é assim que "previsto vira realizado" acontece.
4. **Palavra genérica não casa** (`compra`, `cartão`, `pix`, `pagamento`, `boleto`…). Casamento por palavra-chave exige um token de 4+ letras que não esteja nessa lista; contenção de uma descrição na outra só vale se a menor tiver algum token assim.
5. **Cada candidato é reivindicado por uma linha só**, inclusive por linhas que já estão esperando de importações anteriores.
6. ~~Mesmo extrato em dois formatos vai para a fila~~ → **com a conta escolhida, os dois formatos coincidem** (23/09). A conta do usuário entra no hash e no `external_id` no lugar do ACCTID; CSV e OFX na mesma conta são reconhecidos como já importados, e contas diferentes continuam distintas. O ACCTID do arquivo é só **aviso** (guardado em `file_ref` da conta na primeira importação; a prévia devolve `aviso_conta` se vier de outra conta).
7. **Entidade Conta (mínima):** `id, user_id, name, kind (checking|savings|investment|wallet; `card` saiu na Fatia 5), file_ref, created_at`; nome único por usuário sem diferenciar caixa/espaços. Rotas `GET /api/accounts/user/{id}`, `POST /api/accounts`, `PATCH /api/accounts/{id}`.
8. **Decisões na importação:** o commit aceita `decisoes` = `{import_hash: merge|not_duplicate|queue}`; sem decisão a suspeita vai para a fila; decisão para linha não suspeita é recusada (400). A prévia traz `totais {entradas, saidas}` para denunciar sinal invertido.
9. **Modelo padrão:** `GET /api/import/template/{csv|xlsx}` é a fonte única do layout `data;descricao;valor` (aba de dados só com cabeçalho; exemplos na aba "Como preencher").
10. **Frontend:** a importação é a página `/finance/importar` (substituiu o diálogo); o botão em Transações é um link.
7. **Ao fundir, a data do usuário prevalece** se o registro já estava efetivado (é edição dele); se estava previsto, herda a data do extrato.
8. **Fundir com valor diferente** (escolha manual — juros, tarifa) mantém o valor do usuário e grava `amount_bank` no evento, em vez de deixar a diferença sumir.
9. **Prévia e commit recalculam a partir do arquivo.** O commit não aceita linhas do cliente: o que entra na base não pode depender de um payload adulterável.
10. **Linha inválida é reportada, nunca engolida** — com número da linha e motivo em português. As válidas entram.
11. **Erro de falso negativo custa mais que o de falso positivo:** suspeitar demais vira uma linha a conferir; suspeitar de menos duplica dinheiro em silêncio.

### Decisões de implementação (Fatia 4, 02/10)

O spec dizia "transações sem categoria" sem recortar. Como ficou, e por quê (rever se o uso mostrar outra coisa):

1. **Fila e balde usam o mesmo recorte:** confirmado, **efetivado** e `category_id IS NULL`. Previsto fica de fora: uma recorrência sem categoria poria 12 ocorrências na fila, e classificar uma não resolveria as outras.
2. **Receita sem categoria entra na fila**, porque classificar é o mesmo trabalho. **No balde de Relatórios, não entra**, porque o gráfico é de despesas.
3. **Transferência interna fica fora da fila, do balde e de toda soma** (receita, despesa, saldo, gráficos, mapa de calor), e só aparece em listas. ~~`get_dashboard_summary` ainda soma transferência interna~~ → corrigido em 02/10 no resumo e na Visão Geral, que agora seguem Transações, onde já estava assim. Os 4 lançamentos marcados por engano nos dados foram desmarcados (backup em `data/_backup-2026-10-02/`).
7. **A Visão Geral também mostra o balde** "Sem categoria", em despesas e em receitas, e o "maior categoria" do card conta só as categorias reais.
4. **O percentual do aviso** é calculado sobre o total do gráfico (categorias reais + balde) e arredondado **para cima**, para que 0,4% não apareça como 0%.
5. **A fila filtrada** é `/finance/revisar?secao=sem-categoria` (ou `conciliar`). Um valor desconhecido mostra a fila inteira.
6. **O aviso "sem categoria" do sino** continua lá e agora aponta para a fila. Quem o remove é a #2 (Q4 do grilling do sino).

**Layout do CSV/XLSX da aplicação:** colunas `data`, `descricao`, `valor` (aliases aceitos: `historico`, `memo`, `amount`…) e `id` opcional. Data `DD/MM/AAAA` ou `AAAA-MM-DD`; valor **assinado** (negativo = saída), com vírgula ou ponto decimal; separador `;` ou `,` detectado. `.xls` antigo é recusado com orientação para salvar como `.xlsx`.

**Ainda sem decisão de modelo:** OFX de **cartão de crédito** é lido como qualquer outro extrato, mas a relação entre a fatura paga na conta corrente e as compras no cartão (dupla contagem) segue em aberto.

### Conciliar

Ao confirmar que a linha duplica um registro existente, **fundir**: o registro que permanece mantém `id`, `category_id` e tudo que foi editado, mas **absorve** `external_id`, `import_hash` e a descrição do banco; a linha em espera é removida e o evento `reconciled_with` entra no histórico.

Sem essa absorção, o registro que ficou continua sem identificador de origem — e **na próxima importação do mesmo período a mesma linha volta como suspeita**, indefinidamente. Vale principalmente para o registro digitado à mão, que é justamente o que não tem dado nenhum do banco.

Ao confirmar que **não** é duplicata: `ingest_state` passa a `confirmed` e o registro entra normalmente.

## Dívida encontrada no backend (limpar na Fatia 1)

Levantado ao escrever este spec, em 22/09:

- **`app/schemas/` é código morto e quebrado.** `schemas/transaction.py` faz `from app.models.transaction import TransactionType`, e **`app/models/` não existe**. O pacote só não explode porque nada fora dele o importa: `main.py` declara um `TransactionCreate` próprio, inline, duplicando o contrato. Hoje há duas definições da mesma coisa e a "oficial" é a que não roda.
- **`app/api/` é uma pasta vazia**, sobra do scaffold de 12/09.
- O `TransactionCreate` de `main.py` aceita `transaction_date` como `str | None` — e `create_transaction` no `data_service` grava `datetime.now()` quando vem nulo. É a origem do achado de 19/09 ("o formulário manual grava sempre a data de hoje").

**Decisão para a Fatia 1:** uma definição só do contrato, em `app/schemas/`, com `main.py` importando de lá; `app/models/` criado com os enums (`TransactionType`, `IngestState`, `SeriesKind`, `Scope`) ou o import removido — não manter as duas. Pasta `app/api/` removida ou usada de verdade ao adicionar as rotas novas, que são muitas para caber em `main.py`.

## Rotas de API (FastAPI)

Existentes hoje: `GET /api/transactions`, `GET /api/transactions/user/{id}`, `POST /api/transactions`, `GET /api/scheduled/user/{id}`.

| Método | Rota | Observação |
|---|---|---|
| `GET` | `/api/transactions/user/{user_id}` | ganha filtros `?month=`, `?ingest_state=`; **por padrão só `confirmed`** |
| `POST` | `/api/transactions` | `category_id` obrigatório; aceita `series` para criar série junto |
| `PATCH` | `/api/transactions/{id}` | corpo aceita `scope` (`only_this`/`this_and_future`/`all`) |
| `DELETE` | `/api/transactions/{id}?scope=` | idem |
| `POST` | `/api/transactions/{id}/settle` | body `{ "on": "YYYY-MM-DD" }`, default hoje |
| `POST` | `/api/transactions/{id}/postpone` | body `{ "scope": "..." }` |
| `GET` | `/api/series/user/{user_id}` | |
| `POST` | `/api/series/extend` | idempotente; chamada na virada do mês e na navegação além do horizonte |
| `POST` | `/api/import/preview` | upload → parse + detecção, **sem gravar** |
| `POST` | `/api/import/commit` | grava confirmadas e as em espera; devolve o resumo |
| `POST` | `/api/reconcile/{id}` | body `{ "action": "merge" \| "not_duplicate", "with_id": 88 }` |
| `GET` | `/api/review/user/{user_id}` | as duas seções da tela "A revisar" |
| ~~`GET`~~ | ~~`/api/scheduled/user/{id}`~~ | **removida** na Fatia 1; Agendadas passa a usar `/api/transactions` |

### Contrato de erro — duas chaves, e isso é conhecido

Toda resposta de dados é `{"data": ...}` (31 rotas, sem exceção). A resposta de
erro **não** é uniforme, e o frontend foi construído para tolerar as duas:

| Forma | Quem produz | Quando |
|---|---|---|
| `{"detail": "frase"}` | `raise HTTPException(status_code, detail=...)` | erro de negócio (16 sites) |
| `{"detail": [{loc, msg, type}]}` | FastAPI, validação do Pydantic | 422 (9 rotas com corpo) |
| `{"error": "frase"}` | `return {"error": "..."}, 404` escrito à mão | "não encontrado" (6 sites) |

A terceira é dívida conhecida: `GET /api/users/{id}`, `POST /api/transactions/bulk`,
`PATCH` e `DELETE /api/transactions/{id}` e as duas rotas de negócio usam
`error`, o resto usa `detail`. **Unificar é dívida de Fatia futura** — até lá,
`lib/api.ts` resolve `detail` → `error` → frase genérica do status.

## Caminho único até a API (`lib/api.ts`)

O frontend não chama `fetch` diretamente: as 33 chamadas passam por
`api(caminho, { method, body, query, signal })`, que desembrulha `data` e lança
`ApiError` (com `status`, `detail` cru e `message` já em português) em `!ok`.
`API_URL` e `CURRENT_USER_ID` moram no mesmo módulo, e `apiUrl()` monta a URL do
link de download do modelo, que é navegação e não requisição.

Duas regras que o módulo impõe e que valem para o backend:

- **Upload é `FormData` e não leva `Content-Type`** — o boundary é do browser.
- **Resposta sem `data` em 2xx é erro**, não sucesso vazio: foi o que permitia
  que um 500 aparecesse na tela como lista vazia.

## Rotas de frontend (Next.js App Router)

Existentes: `/finance`, `/finance/transactions`, `/finance/agendadas`, `/finance/relatorios`, `/finance/patrimonio`.

- **Nova:** `/finance/revisar` — tela "A revisar", com as duas seções. Entra no `FinanceNav` como 6ª entrada, com contador. **Rótulo "A revisar", nunca "Pendências"** — esse nome já está ocupado em Agendadas (`PendingAlert.tsx` = contas a pagar do mês) e significa outra coisa.
- `/finance/transactions` ganha importação e filtro por série.
- `/finance/relatorios`: balde "Sem categoria" em `--foreground`, fora da escala de ranking das categorias reais, encabeçando a lista quando for o maior, clicável para `/finance/revisar`, e aviso de percentual quando > 0.

### Transações pela URL (issue #6)

A tela `/finance/transactions` é **endereçável**: o que ela mostra (um lançamento em edição, uma lista filtrada) é descrito por parâmetros da URL, e abrir o link reproduz exatamente isso. Visão Geral e Relatórios geram esses links, então **os nomes são estáveis**:

| Parâmetro | Valor | Efeito |
|---|---|---|
| `editar` | id inteiro positivo | abre a edição do lançamento; se não existe (apagado, de outro usuário), a tela abre normal com um aviso curto |
| `q` | texto | busca por descrição |
| `tipo` | `entrada` ou `saida` | só entradas ou só saídas |
| `categoria` | id (repetível) | uma ou mais categorias; id que não existe é ignorado |
| `de`, `ate` | `AAAA-MM-DD` | intervalo **inclusivo** sobre a data que a tabela mostra (efetivação, ou vencimento se previsto) |

Regras: valor inválido é ignorado em silêncio, e um intervalo invertido (`de` depois de `ate`) é ignorado por inteiro. A tela escreve a URL de volta com `replaceState`, sem criar entrada de histórico por tecla digitada; fechar a edição tira o `editar`, para o botão voltar não reabri-la. A lógica de ler e montar os parâmetros é pura e tem teste próprio (`transacoes-url.test.ts`).

### Saldo por conta e Saldo da página (issue #12)

`GET /api/dashboard/{user_id}` ganha `accounts_balance` (lógica em `services/saldos.py`; nada é gravado):

```json
"accounts_balance": {
  "accounts": [{ "account_id": 1, "name": "Itaú", "kind": "checking", "balance": 1300.0 }],
  "no_account": { "balance": 70.0 },
  "total": 1370.0
}
```

- `accounts[].balance` = saldo inicial + entradas − saídas **efetivadas** da conta, em ordem alfabética sem diferenciar caixa. Previsto e ingestão pendente não entram.
- **As pontas de transferência interna contam** na conta de cada uma (o saldo tem que bater com o extrato). Receita, despesa e relatórios continuam sem elas. Com só uma ponta importada, o `total` oscila; com as duas, se anula.
- `no_account` é `null` quando nenhum efetivado está sem conta; senão `{ "balance": x }`. Lançamento cuja conta não existe mais para o usuário também cai aí, para a soma fechar.
- `total` = soma dos saldos das contas + `no_account`: é o **Saldo da página**. Sem contas cadastradas, tudo está em `no_account` e o total é receita menos despesa, como era.
- `balance`, `income` e `expense` seguem como antes: `balance` é o **Resultado** (receita menos despesa, sem transferência), não o Saldo. O Saldo é `accounts_balance.total`.

### Próximos vencimentos (issue #13)

`GET /api/dashboard/{user_id}/upcoming?hoje=AAAA-MM-DD`. `hoje` é obrigatório e vem do relógio local do cliente (determinístico, e certo em UTC-3); inválido responde 422. A conta mora em `app/services/vencimentos.py`; nada é gravado.

```json
"data": {
  "a_pagar":   [{ "id": 5, "description": "Aluguel", "amount": 10.0, "due_date": "2026-09-15", "overdue": true }],
  "a_receber": []
}
```

- Entram só lançamentos **previstos** (sem `settled_at`) do usuário: despesa = `a_pagar`, receita = `a_receber`. Efetivado, transferência interna e ingestão pendente ficam fora.
- Cada lista tem **até 5** itens ordenados por `due_date` (o `id` desempata). Como atrasado é vencimento antes de hoje, a ordenação já o põe primeiro; `overdue` marca para a tela destacar. Vencer hoje não é atrasado.
- **Sem janela**: a janela de dias é do sino (`avisos.ts`) e a soma do sino não muda. Sem previstos, as duas listas vêm vazias (não é erro) e a tela mostra "Nada a pagar nem a receber" com link para Agendadas.
- Todo item e o "Ver todos" levam a `/finance/agendadas`. A fatura do cartão como linha a pagar é a etapa 2. Componente: `finance/_components/ProximosVencimentos.tsx`; a posição na página é provisória (layout final no ticket #23). Teste: `backend/scripts/testa_vencimentos.py`.

### Relatórios por período (issue #14)

`GET /api/reports/summary/{user_id}?hoje=AAAA-MM-DD&periodo=<atalho>[&de=&ate=]`. `hoje` é obrigatório: quem decide o dia é o relógio local do cliente, e é isso que deixa o teste determinístico. `periodo` é um de `hoje`, `semana`, `mes` (padrão), `mes_anterior`, `ultimos_3_meses`, `ultimos_6_meses`, `ultimos_12_meses`, `ano`, `personalizado` (este exige `de` e `ate`). Pedido inválido responde 422 com `detail` em frase. A conta mora em `app/services/relatorios.py` e só ali; a tela não recalcula intervalos.

Resposta (`data`): `periodo {atalho, de, ate, aberto}`, `anterior {de, ate}`, `anterior_inteiro {de, ate}` e três cartões, `receita`, `despesa` e `resultado`, cada um `{valor, anterior, anterior_inteiro, diferenca, percentual}`. Não há Saldo.

Regras:

- **Aberto** (hoje, semana, mês, últimos N meses, ano): vai do início até hoje e `anterior` é o **mesmo trecho** deslocado (1 dia, 7 dias, N meses; mês curto encolhe o dia: 31/03 compara com 28/02). A semana começa na **segunda**. "Últimos N meses" são N meses de calendário terminando no atual (inclui o corrente, ainda aberto).
- **Fechado** (mês anterior): `anterior` é o mês anterior inteiro. **Personalizado**: `anterior` é a janela imediatamente anterior de mesma duração; também fechado.
- `anterior_inteiro` é sempre o período anterior por inteiro (igual a `anterior` nos fechados); a tela o mostra ao lado só nos abertos.
- `percentual` é `diferenca / |anterior| * 100`, uma casa decimal, e é **`null`** quando o anterior é zero ou vazio (a tela escreve "—"); `diferenca` em reais existe sempre. Nunca "novo".
- Conta só lançamento **efetivado** (`settled_at`), pela **data do lançamento** (`settled_at`, a que Transações mostra), sem transferência interna e sem ingestão pendente. Estorno e pagamento de fatura entram com a Fatia 5.
- A URL da tela leva `periodo` (ausente = este mês) e, no personalizado, `de` e `ate`; a leitura e a montagem são puras e testadas em `frontend/lib/relatorios-periodo.ts`.

### Despesas por categoria do período (issue #17)

`GET /api/reports/categories/{user_id}`, com os mesmos parâmetros e o mesmo 422 do resumo. A conta é `relatorios.categorias` e reaproveita `resolver_periodo` e `_cartao`. Mesmo recorte do resumo, só **despesa**: efetivado, pela data do lançamento, sem transferência interna nem ingestão pendente. Estorno entra com a Fatia 5 (não existe ainda).

Resposta (`data`): `periodo`, `anterior`, `anterior_inteiro` (como no resumo) e:

- `categorias`: só as reais com despesa **no período**, da maior para a menor. Cada uma é `{category_id, nome, valor, anterior, anterior_inteiro, diferenca, percentual}` (o cartão do resumo; `percentual` é `null` quando o anterior é zero e a tela escreve "—"). Categoria que só tem despesa no anterior não aparece. Categoria apagada vira "Outro".
- `sem_categoria`: o balde virtual, **fora** de `categorias`, com o mesmo cartão sem `category_id`/`nome`; `null` se não há despesa sem categoria no período. Receita sem categoria não entra (Fatia 4, item 2).
- `total`: categorias reais + balde, a base do gráfico.
- `percentual_sem_categoria`: inteiro sobre o `total`, arredondado **para cima** (regra da Fatia 4); 0 sem balde.

Tela: `DespesasPorCategoria` (em `relatorios/_components/`) segue o período da página, mostra variação e anterior sob cada rótulo e mantém pizza, barras e segmentada. O balde continua em `--foreground`, fora da escala das reais, e (como antes) encabeça a lista quando é o maior. Clique: categoria real vai a `/finance/transactions?tipo=saida&categoria=<id>&de=&ate=` (`hrefCategoria` em `lib/relatorios-categorias.ts`, sobre `montarBusca`); o balde vai a `/finance/revisar?secao=sem-categoria`. Sem despesa no período: "Sem lançamentos neste período" (o bloco não some). `/api/dashboard` segue servindo só a Visão Geral.

### Maiores gastos (issue #19)

`GET /api/reports/top-expenses/{user_id}`, com os mesmos parâmetros e o mesmo 422 do resumo. A conta é `relatorios.maiores_gastos`. Mesmo recorte de despesas por categoria (efetivado, pela data do lançamento, sem transferência interna nem ingestão pendente). Devolve `gastos`: no máximo 10 (`LIMITE_MAIORES_GASTOS`), do maior valor para o menor; no empate, o mais recente e depois o maior `id`. Cada gasto: `id`, `description`, `amount`, `settled_at`, `category_id` e `category_name` (nulos se sem categoria). Tela: `MaioresGastos`; cada linha vai a `/finance/transactions?editar=<id>` (`hrefLancamento` em `lib/relatorios-gastos.ts`). Sem despesa: "Sem despesas neste período". O limite de 10 é decisão do ticket (o spec #7 só pede "ordem e limite corretos"). Por comerciante fica para a Fatia 6.

### Últimas transações (issue #16)

`GET /api/dashboard/{user_id}/recent`, sem parâmetros: o dia de cada item vem pronto, então não há `hoje`. "Hoje" e "Ontem" são do cliente (relógio local, `lib/ultimas.ts`). A conta mora em `app/services/ultimas.py`; nada é gravado.

- Os 8 lançamentos **efetivados** mais recentes (`settled_at` desc, `id` desc desempata). Previsto e ingestão pendente ficam fora. A transferência interna **continua na lista** (é lista, não soma), com marca.
- Item: `{id, description, amount, type, day, category_id, account_name, is_internal_transfer, imported}`. `day` é `AAAA-MM-DD` de `settled_at`; `account_name` é nulo sem conta; `imported` é verdadeiro com `import_hash` ou `external_id`. O nome da categoria o cliente resolve por `/api/categories`.
- Tela: agrupada por dia (Hoje, Ontem, depois `DD/MM/AAAA`); valor com sinal (`+`/`-`), entrada em `foreground`, saída em `destructive`, transferência neutra; "Sem categoria" leva a `/finance/revisar?secao=sem-categoria`; a linha abre `/finance/transactions?editar=<id>` (issue #6); "Ver todas" leva a `/finance/transactions`; vazio mostra "Nenhuma transação ainda" e o botão de novo lançamento (abre o dialog da página). Valores em `MoneyValue` (privacidade). Componente: `finance/_components/UltimasTransacoes.tsx`. Testes: `backend/scripts/testa_ultimas.py` e `frontend/lib/ultimas.test.ts`.

## Cartão (Fatia 5, ticket #21)

Entidade própria, separada de Conta (coleção `cards`). Cartão não é Conta: o valor `card` saiu de `AccountKind` e a API de contas o recusa (422).

**Campos:** `id`, `user_id`, `name`, `limit` (>= 0), `closing_day` (1 a 31), `due_day` (1 a 31), `default_payer_account_id` (opcional; precisa ser Conta do mesmo usuário), `file_ref` (reservado para a importação do cartão), `created_at`. Nome único por usuário, sem diferenciar caixa e espaços.

| Método | Rota | Observação |
|---|---|---|
| `GET` | `/api/cards/user/{user_id}` | em ordem alfabética |
| `POST` | `/api/cards` | corpo `{user_id, name, limit, closing_day, due_day, default_payer_account_id?}`; validação de negócio devolve 400 com frase |
| `PATCH` | `/api/cards/{id}` | só o que vier preenchido muda; `default_payer_account_id: 0` remove a conta pagadora; 404 se não existe |

**Lançamento:** ganha `card_id` e `invoice_id` (nulos). Lançamento antigo, sem o campo gravado, é devolvido com os dois nulos. Nada os preenche ainda (compra no cartão e Fatura são tickets seguintes).

Lógica em `backend/app/services/cartoes.py`; aceite em `backend/scripts/testa_fatia5.py`; tela em `/finance/cartoes`.

## Migração (Fatia 1)

1. **Backup** de `backend/data/` antes de qualquer escrita — o projeto tem git, mas o `data/` é dado, não código.
2. Para cada item de `scheduled.json`: criar a `series` correspondente (`nature` → `kind`, `frequency`, `installment` → `total_count`) e gerar as transações do horizonte, com `due_date` a partir de `due_date`/`anchor_day` e `settled_at` preenchido apenas onde `status == "paid"`.
3. Apontar Agendadas para `/api/transactions`.
4. **Só então** remover `scheduled.json` — movendo para o backup, nunca apagando (padrão já registrado: sem git no dado, mover em vez de apagar).
5. **Verificação obrigatória:** os números do dashboard e dos relatórios antes e depois da migração têm que ser idênticos. Qualquer divergência é bug de migração, não "ajuste esperado".

## Ambiguidades resolvidas (não reabrir sem discussão)

1. **"Sem categoria" entra nos relatórios?** Sim — o total não pode mentir. Mas item aguardando conciliação **não** entra: são coisas diferentes.
2. **Cor do balde nulo?** Segue o peso, em escala paralela, em `--foreground`. Esconder em cinza foi proposto e **recusado**: se o não classificado é o maior peso, é isso que o relatório precisa gritar.
3. **Espelho de conciliação em base separada?** Não — mesma tabela, via `ingest_state`. A tabela já controla visibilidade por estado desde a decisão de fonte única.
4. **Lápide para registro excluído?** Não. Proposta e **recusada**: previsibilidade acima de proteção.
5. **Excluir a série preserva parcelas já pagas?** Não. Proposta e **recusada**: as três opções de escopo já são a resposta, e quem decide é o usuário.
6. **Materializar todo o intervalo ao navegar longe?** Não. Proposta e **recusada**: o app não tem soma de faixa longa, então a consistência defendida não servia a nenhuma consulta real.
