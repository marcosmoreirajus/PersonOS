# Spec Técnica — Módulo Negócio (PersonOS)

Especificação funcional para implementação. Sem código — define arquivos, formato de dados, campos e rotas.

## Convenção geral de dados

- Cada página do módulo Negócio vira **um arquivo Markdown**, salvo em `data/business/<page>.md` (mesmo padrão de pasta `data/` usado hoje pelo módulo Finanças, que guarda `users.json`, `categories.json`, `transactions.json`).
- Estrutura de cada arquivo: **frontmatter YAML com metadados da página** (título, seção, slug, data de atualização) + **corpo em Markdown com um heading `##` por campo**, seguido do texto livre daquele campo.
  - Motivo de não colocar o conteúdo dos campos dentro do próprio frontmatter: os campos são majoritariamente texto longo (parágrafos), e YAML multilinha dentro de frontmatter é frágil de editar manualmente e pouco natural para um agente de IA gerar/interpretar depois. Heading + texto é o formato mais robusto tanto para parsing simples (split por `## `) quanto para leitura humana.
  - O frontmatter fica reservado para metadados estruturais (não para o conteúdo em si), mantendo uma separação clara entre "sobre o quê é o arquivo" e "o que o usuário escreveu".
- Todas as 4 páginas seguem exatamente a mesma convenção — isso é o que permite escrever um único parser/serializer genérico no backend (`page` → arquivo, `page` → lista de campos esperados).

### Frontmatter padrão (igual nas 4 páginas)

```yaml
---
title: "<Título da página>"
section: "business"
page: "<slug da página>"
updated_at: "<ISO 8601 timestamp>"
---
```

### Campo ausente/vazio

Se um campo ainda não foi preenchido, seu heading existe no arquivo (ou é criado ao salvar) com o corpo vazio. O frontend trata corpo vazio como estado vazio (placeholder), não como erro.

---

## Página 1 — Founder

- **Arquivo:** `data/business/founder.md`
- **Frontmatter:** `title: "Founder"`, `page: "founder"`

| Campo | Nome no arquivo (`## heading`) | Tipo | Obrigatório |
|---|---|---|---|
| Objetivo | `## Objetivo` | Texto longo (textarea) | Opcional (recomendado no onboarding) |
| Estilo de Vida | `## Estilo de Vida` | Texto longo (textarea) | Opcional |

### Exemplo preenchido — `founder.md`

```markdown
---
title: "Founder"
section: "business"
page: "founder"
updated_at: "2026-09-12T14:32:00-03:00"
---

## Objetivo

Construir um negócio que sustente minha família sem depender de mim
trabalhando mais de 6 horas por dia até 2027.

## Estilo de Vida

Quero flexibilidade de horário para buscar meus filhos na escola e
não trabalhar aos finais de semana.
```

---

## Página 2 — Direção

- **Arquivo:** `data/business/direction.md`
- **Frontmatter:** `title: "Direção"`, `page: "direction"`

| Campo | Nome no arquivo (`## heading`) | Tipo | Obrigatório |
|---|---|---|---|
| Mapa do Mercado | `## Mapa do Mercado` | Texto longo (textarea) | Opcional |
| Mapa de Problemas | `## Mapa de Problemas` | Texto longo (textarea) | Opcional |
| Perfil Ideal de Cliente | `## Perfil Ideal de Cliente` | Texto longo (textarea) | Opcional |
| Tese de Valor | `## Tese de Valor` | Texto longo (textarea) | Opcional |
| Oferta | `## Oferta` | Texto longo (textarea) | Opcional |

> Nota: o campo "Oferta" aparece tanto em Direção quanto em Validação (ver abaixo), de propósito — em Direção é a oferta **planejada/hipótese**; em Validação é o registro de como essa oferta está sendo **testada na prática**. São campos independentes em arquivos diferentes, não duplicação por engano.

---

## Página 3 — Validação

- **Arquivo:** `data/business/validation.md`
- **Frontmatter:** `title: "Validação"`, `page: "validation"`

| Campo | Nome no arquivo (`## heading`) | Tipo | Obrigatório |
|---|---|---|---|
| Oferta | `## Oferta` | Texto longo (textarea) | Opcional |
| Primeiros Clientes | `## Primeiros Clientes` | Texto longo (textarea) | Opcional |

---

## Página 4 — Caixa

- **Arquivo:** `data/business/cash.md`
- **Frontmatter:** `title: "Caixa"`, `page: "cash"`

| Campo | Nome no arquivo (`## heading`) | Tipo | Obrigatório |
|---|---|---|---|
| Fluxo de Caixa | `## Fluxo de Caixa` | Texto longo (textarea) | Opcional |
| ERP | `## ERP` | Texto longo (textarea) | Opcional |

---

## Rotas de API (backend FastAPI)

Segue o mesmo padrão do módulo Finanças: sem SQLAlchemy, sem banco — o backend lê e escreve os arquivos `.md` diretamente (equivalente ao `DataService` que hoje usa `json.load`/`json.dump`, mas com um parser de Markdown+frontmatter no lugar do parser JSON). Envelope de resposta consistente com o já usado em Finanças (`{"data": ...}`).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/business/founder` | Retorna os campos da página Founder |
| PUT | `/api/business/founder` | Atualiza um ou mais campos da página Founder |
| GET | `/api/business/direction` | Retorna os campos da página Direção |
| PUT | `/api/business/direction` | Atualiza um ou mais campos da página Direção |
| GET | `/api/business/validation` | Retorna os campos da página Validação |
| PUT | `/api/business/validation` | Atualiza um ou mais campos da página Validação |
| GET | `/api/business/cash` | Retorna os campos da página Caixa |
| PUT | `/api/business/cash` | Atualiza um ou mais campos da página Caixa |

### Formato de request/response (proposto)

`GET /api/business/founder`:
```json
{
  "data": {
    "page": "founder",
    "title": "Founder",
    "updated_at": "2026-09-12T14:32:00-03:00",
    "fields": {
      "objetivo": "Construir um negócio que sustente minha família...",
      "estilo_de_vida": "Quero flexibilidade de horário..."
    }
  }
}
```

`PUT /api/business/founder` (body):
```json
{
  "fields": {
    "objetivo": "Novo texto do objetivo...",
    "estilo_de_vida": "Novo texto do estilo de vida..."
  }
}
```
Resposta: mesmo formato do GET, já com `updated_at` atualizado.

Observação: as chaves em `fields` usam `snake_case` derivado do heading (`"Estilo de Vida"` → `estilo_de_vida`), mantendo o mesmo padrão de nomenclatura já usado nos JSONs do módulo Finanças (`user_id`, `category_id`, etc.). O mapeamento heading ↔ chave é fixo por página (definido no backend), não inferido dinamicamente.

Assim como as rotas mock de Finanças (ex.: `POST /api/transactions`), essas rotas não têm autenticação/validação adicional nesta fase além do que já existir globalmente no PersonOS.

---

## Rotas de Frontend (Next.js)

URLs em inglês, títulos em português na UI (mesmo padrão do restante do PersonOS):

| Rota | Página (UI, em português) |
|---|---|
| `/business/founder` | Founder |
| `/business/direction` | Direção |
| `/business/validation` | Validação |
| `/business/cash` | Caixa |

> Sugestão adicional (fora do pedido original, avaliar com o usuário): uma rota `/business` funcionando como índice/hub, com links para as 4 páginas e talvez um resumo do que já foi preenchido em cada uma. Não é requisito do MVP, mas evita que o usuário precise saber as 4 URLs de cabeça.

---

## Ambiguidades resolvidas (para validação do usuário)

1. **"Ima de Problemas" → "Mapa de Problemas".** Interpretado como erro de digitação de "Mapa de Problemas" (mantendo o padrão "Mapa de X" já usado em "Mapa do Mercado"). Alternativa descartada: "Mapa de Dores" — mais comum em português de marketing, mas escolhi manter "Problemas" por ser a palavra mais próxima do que foi escrito e por já existir "Mapa do Mercado" como par estrutural.
2. **"Primeiros" (Validação) → "Primeiros Clientes".** O campo original só dizia "Primeiros", sem complemento. Interpretei como "Primeiros Clientes" por ser mais abrangente que "Primeiras Vendas" (cobre também clientes que testaram sem necessariamente ter gerado receita ainda, o que é comum em fase de validação). Se o uso pretendido for estritamente transacional, o nome pode ser trocado para "Primeiras Vendas" sem impacto em nenhuma outra parte da spec.
3. **Campo "Oferta" duplicado (Direção e Validação).** Mantido como dois campos independentes de propósito — em Direção é a oferta planejada, em Validação é o relato de como ela está sendo testada no mercado. Se essa distinção não for a intenção original, os dois campos podem ser consolidados em um só (ficaria em Direção, e Validação teria só "Primeiros Clientes").
4. **Tipo de campo "ERP".** Interpretado como texto longo/textarea para anotações livres (ex.: qual sistema é usado, link de acesso, observações), não como um campo estruturado de integração real com um ERP. Não há integração técnica com sistemas de ERP nesta fase — é só um campo de anotação.
5. **Obrigatoriedade dos campos.** Todos os campos foram definidos como opcionais no MVP, já que o módulo é uma ferramenta de reflexão/registro, não um formulário de cadastro. Nenhum campo bloqueia o uso das demais páginas se ficar em branco.
