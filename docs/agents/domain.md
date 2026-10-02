# Documentação de domínio

Como as skills de engenharia devem usar a documentação de domínio deste repo ao explorar o código.

## Antes de explorar, leia

- **`GLOSSARY.md`** na raiz do repo, ou
- **`GLOSSARY-MAP.md`** na raiz, se existir: ele aponta um `GLOSSARY.md` por contexto. Leia os que tiverem a ver com o assunto.
- **`docs/adr/`**: leia os ADRs que tocam a área em que você vai trabalhar. Em repos multi-context, veja também `src/<context>/docs/adr/` para decisões de um contexto específico.

Se algum desses arquivos não existir, **siga em silêncio**. Não aponte a ausência nem sugira criá-los de antemão. A skill `/domain-modeling` (acionada via `/grill-with-docs` e `/improve-codebase-architecture`) cria esses arquivos sob demanda, quando termos ou decisões forem de fato resolvidos.

## Estrutura de arquivos

Este repo é **single-context**:

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-exemplo-de-decisao.md
│   └── 0002-outra-decisao.md
├── backend/
└── frontend/
```

Para referência, um repo multi-context (com `GLOSSARY-MAP.md` na raiz) fica assim:

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← decisões do sistema todo
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← decisões do contexto
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use o vocabulário do glossário

Quando a sua saída nomear um conceito de domínio (título de issue, proposta de refatoração, hipótese, nome de teste), use o termo como definido no `GLOSSARY.md`. Não troque por sinônimos que o glossário evita explicitamente.

Se o conceito que você precisa ainda não está no glossário, isso é um sinal: ou você está inventando um termo que o projeto não usa (reconsidere), ou há uma lacuna real (anote para o `/domain-modeling`).

## Aponte conflitos com ADRs

Se a sua saída contradiz um ADR existente, diga isso explicitamente em vez de passar por cima em silêncio:

> _Contradiz o ADR-0007 (pedidos com event sourcing), mas vale reabrir porque…_
