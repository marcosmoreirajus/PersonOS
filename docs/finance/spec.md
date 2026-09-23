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

## Rotas de frontend (Next.js App Router)

Existentes: `/finance`, `/finance/transactions`, `/finance/agendadas`, `/finance/relatorios`, `/finance/patrimonio`.

- **Nova:** `/finance/revisar` — tela "A revisar", com as duas seções. Entra no `FinanceNav` como 6ª entrada, com contador. **Rótulo "A revisar", nunca "Pendências"** — esse nome já está ocupado em Agendadas (`PendingAlert.tsx` = contas a pagar do mês) e significa outra coisa.
- `/finance/transactions` ganha importação e filtro por série.
- `/finance/relatorios`: balde "Sem categoria" em `--foreground`, fora da escala de ranking das categorias reais, encabeçando a lista quando for o maior, clicável para `/finance/revisar`, e aviso de percentual quando > 0.

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
