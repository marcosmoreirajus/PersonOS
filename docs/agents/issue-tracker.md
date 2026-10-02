# Issue tracker: GitHub

As issues e specs deste repo ficam no GitHub Issues. Use o CLI `gh` para todas as operações.

## Convenções

- **Criar uma issue**: `gh issue create --title "..." --body "..."`. Para corpo com várias linhas, use heredoc.
- **Ler uma issue**: `gh issue view <number> --comments`, filtrando os comentários com `jq` e buscando também os labels.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, com os filtros `--label` e `--state` adequados.
- **Comentar numa issue**: `gh issue comment <number> --body "..."`
- **Aplicar / remover labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`

O repo é inferido do `git remote -v`; o `gh` faz isso sozinho quando roda dentro do clone.

## Pull requests como entrada de triagem

**PRs as a request surface: no.** _(Marcação lida pelo `/triage` — mantenha o texto literal em inglês. Troque para `yes` se este repo tratar PRs externos como pedidos de funcionalidade.)_

Quando estiver `yes`, os PRs passam pelos mesmos labels e estados das issues, usando os equivalentes `gh pr`:

- **Ler um PR**: `gh pr view <number> --comments` e `gh pr diff <number>` para o diff.
- **Listar PRs externos para triagem**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` e manter só `authorAssociation` igual a `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` ou `NONE` (descartar `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / rotular / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

O GitHub usa a mesma numeração para issues e PRs, então um `#42` sozinho pode ser qualquer um dos dois: tente `gh pr view 42` e, se falhar, `gh issue view 42`.

## Quando uma skill disser "publicar no issue tracker"

Crie uma issue no GitHub.

## Quando uma skill disser "buscar o ticket relevante"

Rode `gh issue view <number> --comments`.

## Operações de wayfinding

Usadas pelo `/wayfinder`. O **mapa** é uma única issue, e os tickets são issues **filhas**.

- **Mapa**: uma issue com o label `wayfinder:map`, cujo corpo tem as seções Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Ticket filho**: issue ligada ao mapa como sub-issue do GitHub (`gh api` no endpoint de sub-issues). Onde sub-issues não estiverem habilitadas, adicione a filha a uma task list no corpo do mapa e coloque `Part of #<map>` no topo do corpo da filha. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Depois de assumido, o ticket fica atribuído a quem está conduzindo.
- **Bloqueio**: as **dependências nativas de issue** do GitHub, que são a representação canônica e visível na interface. Para adicionar uma aresta: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, onde `<blocker-db-id>` é o **database id** numérico do bloqueador (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _não_ o `#number` nem o `node_id`). O GitHub informa `issue_dependencies_summary.blocked_by` (só bloqueadores abertos, que é o que vale). Sem dependências disponíveis, use uma linha `Blocked by: #<n>, #<n>` no topo do corpo da filha. Um ticket está desbloqueado quando todos os bloqueadores estão fechados.
- **Consulta da fronteira**: liste as filhas abertas do mapa (`gh issue list --state open`, limitado às sub-issues / task list do mapa), descarte as que têm bloqueador aberto (`issue_dependencies_summary.blocked_by > 0`, ou uma issue aberta na linha `Blocked by`) ou responsável atribuído; vence a primeira na ordem do mapa.
- **Assumir**: `gh issue edit <n> --add-assignee @me`, a primeira escrita da sessão.
- **Resolver**: `gh issue comment <n> --body "<answer>"`, depois `gh issue close <n>`, e então acrescente um ponteiro de contexto (resumo + link) em Decisions-so-far no mapa.
