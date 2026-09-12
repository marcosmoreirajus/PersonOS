# PRD — Módulo Negócio (PersonOS)

## Objetivo do MVP

Entregar 4 páginas de conteúdo estratégico (Founder, Direção, Validação, Caixa), cada uma com campos de texto editáveis pelo usuário, persistidos em arquivos Markdown com frontmatter YAML. O usuário deve conseguir escrever, salvar, recarregar a página e ver o conteúdo salvo — sem perda de dados, sem necessidade de banco de dados, sem qualquer automação de IA nesta fase.

O sucesso do MVP não é medido por sofisticação de UI ou de dados — é medido por: **o usuário confia que o que ele escreveu ali fica salvo e não desaparece.**

## User Stories

### Founder

1. Como dono de negócio, quero registrar meu objetivo pessoal/profissional com o negócio, para que eu tenha clareza do "porquê" quando as decisões do dia a dia ficarem difíceis.
2. Como dono de negócio, quero descrever o estilo de vida que busco ter operando esse negócio, para que minhas decisões de crescimento respeitem os limites que eu mesmo defini (ex.: não crescer a qualquer custo se isso destruir minha rotina).
3. Como dono de negócio, quero poder editar essas respostas a qualquer momento, para que elas acompanhem minha evolução e não fiquem congeladas na primeira versão que escrevi.

### Direção

1. Como dono de negócio, quero mapear o mercado em que atuo, para que eu enxergue oportunidades e ameaças antes de decidir onde investir esforço.
2. Como dono de negócio, quero registrar os principais problemas/dores que meu público enfrenta, para que minha oferta continue resolvendo algo real e não vá se distanciando do cliente.
3. Como dono de negócio, quero descrever meu perfil ideal de cliente, para que eu saiba filtrar quem eu quero atender e recusar quem não é o meu público.
4. Como dono de negócio, quero deixar clara minha tese de valor, para que eu consiga explicar em poucas frases por que alguém deveria comprar de mim e não de outro.
5. Como dono de negócio, quero descrever minha oferta atual, para que eu tenha um retrato único de o que estou vendendo hoje, sem precisar procurar em vários lugares.

### Validação

1. Como dono de negócio, quero registrar como a minha oferta está sendo testada no mercado, para que eu acompanhe se a hipótese inicial (definida em Direção) está se confirmando ou precisa mudar.
2. Como dono de negócio, quero anotar informações sobre meus primeiros clientes/vendas, para que eu tenha um registro concreto de validação para revisar decisões futuras.
3. Como dono de negócio, quero poder revisitar essa página conforme o negócio evolui, para que ela reflita o estágio real de validação e não fique desatualizada.

### Caixa

1. Como dono de negócio, quero anotar o panorama do meu fluxo de caixa, para que eu tenha uma visão financeira de alto nível do negócio, mesmo sem um sistema financeiro completo.
2. Como dono de negócio, quero registrar informações/observações sobre o ERP ou sistema que uso para controlar o financeiro do negócio, para que eu (ou alguém que me ajude) saiba onde estão os dados financeiros detalhados.
3. Como dono de negócio, quero manter essas anotações separadas do meu módulo Finanças pessoal, para que eu não misture as finanças da empresa com as minhas finanças pessoais.

## Escopo do MVP

**Entra:**

- As 4 páginas (Founder, Direção, Validação, Caixa) com os campos definidos em `spec.md`.
- Campos de texto editáveis (texto curto e texto longo/textarea, conforme o campo).
- Persistência em arquivo Markdown com frontmatter YAML por página (um arquivo por seção).
- Leitura e escrita via API própria do módulo (backend FastAPI lendo/escrevendo os `.md` diretamente, sem banco de dados).
- Estado vazio (empty state) quando o arquivo/campo ainda não foi preenchido.
- Um usuário, um negócio.

**Fora do escopo / Fase futura:**

- Agentes de IA lendo ou escrevendo automaticamente nesses arquivos (o formato já está pronto para isso, mas nenhuma automação roda no MVP).
- Múltiplos negócios por usuário (hoje é 1:1 usuário-negócio).
- Múltiplos usuários/sócios colaborando no mesmo negócio (multi-tenant, permissões, etc.).
- Histórico de versões / undo dos campos (o arquivo é sobrescrito a cada salvamento; sem changelog).
- Banco de dados relacional (Postgres/Supabase) — só entra quando a UX estiver validada.
- Autenticação específica do módulo Negócio além do que já existir no PersonOS como um todo.
- Qualquer integração automática com o módulo Finanças.
- Anexos, imagens, uploads dentro dos campos.
- Exportação/impressão formatada dessas páginas.

## Critérios de Aceite

1. O usuário consegue abrir a página Founder, editar o campo "Objetivo", salvar, recarregar a página (F5) e ver o valor salvo aparecer corretamente.
2. O mesmo vale para todos os campos das 4 páginas (Direção, Validação, Caixa) — editar, salvar, recarregar, ver o conteúdo persistido.
3. Se um campo nunca foi preenchido, a página carrega normalmente mostrando um estado vazio (placeholder), sem erro.
4. Ao salvar, o arquivo Markdown correspondente é criado/atualizado em `data/business/` com o frontmatter e o conteúdo esperado (verificável abrindo o arquivo diretamente).
5. Nenhuma ação nesse módulo afeta ou lê arquivos/dados do módulo Finanças.
6. Fechar e reabrir o navegador (nova sessão) mantém os dados salvos — a persistência não depende de estado de sessão/memória do frontend.
