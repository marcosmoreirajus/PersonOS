# PRD — Entrada de Dados (Módulo Finanças, PersonOS)

## Objetivo

Hoje o Módulo Finanças só sabe **mostrar** dinheiro: as cinco telas leem JSONs de exemplo e nenhuma delas permite registrar a vida financeira real. Este PRD cobre a frente que fecha esse buraco — **como o dado entra**: lançamento manual, importação de extrato, conciliação do que é duplicado, e séries (recorrências e parcelamentos) que se geram sozinhas.

O sucesso não é medido por quantidade de telas, e sim por: **o usuário consegue trocar os dados de exemplo pela vida financeira dele e confiar nos números que aparecem.** Concretamente, três afirmações precisam ser verdade depois desta entrega:

1. O total de um período nunca mente — nem por omissão (algo que existe e não aparece), nem por inclusão (algo duplicado ou ainda não confirmado somando no saldo).
2. Nada que o usuário decidiu volta sozinho: obrigação cancelada não ressuscita, registro excluído não reaparece, valor reajustado não regride.
3. O que o sistema não sabe fica visível como "não sei", em vez de ser escondido ou chutado.

## Contexto das decisões

Todo o conteúdo deste PRD vem de uma sabatina de duas sessões (21 e 22/09/2026) que fechou ~40 decisões de produto e modelo de dados, incluindo quatro propostas que foram explicitamente **recusadas** e cujo motivo está registrado. Nada aqui é escolha nova de implementação.

## User Stories

### Lançar

1. Como usuário, quero registrar um gasto informando **a data em que ele aconteceu** (não a data de hoje), para que meu histórico reflita a realidade mesmo quando eu registro dias depois.
2. Como usuário, quero que o campo de categoria seja **obrigatório no lançamento manual**, para que a fila de revisão só acumule o que a máquina não soube classificar — e não o que eu tive preguiça de preencher.
3. Como usuário, quero poder marcar um lançamento como **transferência entre contas minhas**, para que ele não seja contado como despesa nem apareça nos relatórios de gasto.
4. Como usuário, quero registrar um gasto **parcelado ou recorrente** uma única vez, para que as ocorrências futuras existam sem eu ter que digitar cada uma.

### Importar e conciliar

5. Como usuário, quero importar o extrato do banco (OFX) ou uma planilha no layout da aplicação, para que meses inteiros entrem de uma vez.
6. Como usuário, quero que o sistema **não deixe duplicata entrar**, apresentando o que ele suspeita antes de gravar, para que eu nunca precise caçar lançamento repetido depois.
7. Como usuário, quero que as linhas limpas entrem **imediatamente**, mesmo que existam suspeitas pendentes, para que uma importação grande não vire uma sessão de trabalho obrigatória.
8. Como usuário, quero que conciliar uma linha importada com um lançamento que **eu digitei à mão** deixe marca no registro, para que a mesma linha não volte a ser suspeita em toda reimportação.
9. Como usuário, quero um resumo ao fim da importação separando **o que foi classificado pela memória** do que precisou de IA, para que eu veja a dependência de IA caindo mês a mês.

### Revisar

10. Como usuário, quero um lugar único — **"A revisar"** — que responda "o que falta eu resolver?", para que pendência não fique espalhada por telas diferentes.
11. Como usuário, quero que o gasto ainda não classificado **apareça nos relatórios** como "Sem categoria", para que o total do mês continue verdadeiro enquanto eu não organizo.
12. Como usuário, quero clicar nesse pedaço do gráfico e cair na fila já filtrada, para que organizar seja o caminho mais curto a partir de onde eu percebi o problema.

### Séries e obrigações

13. Como usuário, quero ver as contas que **vão** vencer e as que **venceram e não paguei** como coisas diferentes, para que meu saldo não conte como pago o que eu não paguei.
14. Como usuário, quero marcar uma conta como paga em **um clique**, com a data ajustável, para que o caso comum (paguei hoje) não exija formulário.
15. Como usuário, quero **adiar** uma obrigação para o mês seguinte sem apagá-la, para que o compromisso continue existindo com a data nova.
16. Como usuário, quero escolher **o alcance** de cada edição, exclusão ou adiamento (só esta / esta e as futuras / a série toda), para que o sistema nunca decida por mim o que é pontual e o que é permanente.
17. Como usuário, quero que cancelar uma assinatura seja definitivo, para que ela não reapareça quando o sistema gerar o próximo mês.

## Escopo

**Entra:**

- Lançamento manual completo (criar, editar, excluir), com data escolhida e categoria obrigatória.
- Importação **OFX** (layout do banco) e **XLS/CSV** em layout definido pela aplicação.
- Detecção de duplicidade na importação, com decisão antes da gravação e fusão ao conciliar.
- Séries: parcelamento e recorrência, com geração automática, escopo em três opções para editar/excluir/pular, e horizonte de geração.
- Estados derivados previsto / atrasado / realizado, a partir de uma data de efetivação gravada.
- Tela **"A revisar"** com duas seções (itens a conciliar + transações sem categoria).
- Relatórios reconhecendo o balde "Sem categoria" (visível, clicável, com aviso de percentual).
- Histórico de eventos por registro.
- Classificação automática: memória determinística primeiro, IA em lote só para o desconhecido, com botão explícito no cadastro manual.
- Migração: `scheduled.json` deixa de existir; Agendadas passa a ser uma visão de transações.

**Fora do escopo / fase futura:**

- **Módulo Contas e Cartões completo** (saldos, extrato por conta, exclusão, ícone do banco). Reaberto em 23/09 só na versão **mínima** (nome + tipo, uma conta por banco), porque a importação exige escolher a conta de destino. Fatura de cartão paga é uma saída comum na conta que pagou.
- **Layouts por banco** (Bradesco, BTG, C6) e mapeamento de colunas: a importação usa OFX e um layout padrão do sistema (CSV/XLSX, modelo para download).
- **Open Finance** e qualquer sincronização automática com banco.
- **WhatsApp / OCR** como canais de entrada.
- Metas e orçamento (módulo próprio, adiado 2x).
- Multiusuário, compartilhamento de casal e visão consolidada familiar — fica caso a caso até existir.
- Banco de dados relacional: o modelo é desenhado para o banco, mas o MVP continua em JSON.
- Desfazer uma importação inteira depois de concluída (o desfazer existe **durante** a conciliação, não depois).

## Fatiamento da entrega

A ordem não é preferência: cada fatia só usa o que a anterior criou, e a primeira é a única irreversível.

### Fatia 1 — Modelo e migração *(irreversível; fazer com backup)*

Transação ganha data de efetivação, estado de ingestão, vínculo de série e histórico de eventos. `scheduled.json` é migrado para transações e deletado. Agendadas passa a ler transações.

**Aceite:** as 5 telas continuam funcionando; `scheduled.json` não existe mais; as obrigações reconstruídas batem **item a item** com as antigas (nome, valor, vencimento, natureza, frequência, parcela, situação).

> ~~nenhum valor do dashboard muda por causa da migração~~ → **o saldo muda pelo somatório das obrigações já efetivadas, e essa variação precisa bater item a item**. Corrigido em 22/09, ao implementar: o critério original era impossível. Fonte única significa que o agendado já pago passa a contar no saldo — exigir que nada mude seria exigir que a migração não fizesse o que foi decidido. O que precisa ser verdade é que a variação seja **explicada**, não que seja zero.

### Fatia 2 — Séries

Entidade série, geração (fim conhecido gera tudo; indefinido usa janela de 12 meses), extensão na virada do mês, projeção além do horizonte, e as três operações com escolha de escopo.

**Aceite:** criar um parcelado 24x gera 24 registros; criar uma recorrência sem fim gera 12; cancelar "esta e as futuras" e forçar uma extensão **não** faz a série voltar; navegar para o 13º mês mostra a projeção sem criar registro.

### Fatia 3 — Importação e conciliação

Página `/finance/importar` em passos (Origem → Revisar → Confirmar), conta de destino, parse, detecção de duplicidade com decisão por linha na revisão, entrada parcial, espelho de espera na própria tabela, fusão ao conciliar.

**Aceite:** importar um arquivo com 3 linhas repetidas de um extrato já importado resulta em 0 duplicatas gravadas; conciliar uma linha com um lançamento manual e reimportar o mesmo arquivo não gera nova suspeita.

### Fatia 4 — "A revisar" e relatórios

Tela nova com duas seções, contador na navegação, e os ajustes de relatório (balde visível pelo peso, clicável, aviso de percentual).

**Aceite:** um mês com metade do gasto sem categoria mostra o balde encabeçando a lista, em `--foreground`, com o aviso de percentual; clicar leva à fila filtrada.

### Fatia 5 — Classificação automática

Memória determinística, IA em lote na importação, botão "Pedir para IA" no cadastro, resumo separando as duas origens.

**Aceite:** a segunda importação de um extrato do mesmo comerciante classifica pela memória, sem chamar a IA, e o resumo mostra isso.

## Critérios de Aceite (transversais)

1. Nenhum item com ingestão pendente aparece em saldo, relatório ou listagem padrão de transações.
2. Nenhuma operação de série deixa o gerador desfazê-la na execução seguinte.
3. Todo valor exibido nas telas respeita o modo privacidade já existente (`MoneyValue`).
4. `tsc` e build limpos; nenhum erro de console nas 5 telas + a tela nova.
5. Toda decisão de comportamento divergente deste PRD volta para discussão, não é resolvida no código.

## Pendências que este PRD não resolve

- **Naming** do produto (Clari vs. PersonOS) — não bloqueia.
- Nomes finais de campos e contratos ficam em `spec.md`, não aqui.
