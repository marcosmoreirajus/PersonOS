# PersonOS

Sistema integrado de gestão pessoal para indivíduos e casais com renda diversificada (PJ + PF).

**Tagline:** Tudo-em-um pronto pra usar: finanças, tarefas, metas, agenda e milhas — sem customização demorada.

## Stack

- **Backend:** Python 3.11+ + FastAPI (dados mock em JSON/Markdown; PostgreSQL planejado)
- **Frontend:** Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- **Infra:** Docker Compose (dev), Railway/Render (prod)

## MVP 1.0 — Escopo

- ✅ Gestão de finanças pessoal (entrada + dashboard + relatórios) — dados mock em JSON
- ✅ Swagger (doc API)
- ⏳ Autenticação JWT — ainda não implementada (frontend usa usuário fixo `id=1`)
- ⏳ Testes básicos — ainda não escritos

**Timeline:** 3-4 semanas

## Estrutura

```
PersonOS/
├── backend/           # FastAPI
│   ├── app/
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Leitura/escrita dos dados mock
│   │   ├── main.py    # Rotas da API
│   │   └── config.py
│   ├── data/          # Dados mock (JSON + Markdown)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          # Next.js
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Quick Start

### Dev Local

1. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Docker Compose

```bash
docker-compose up
```

## Roadmap

### Phase 1 (MVP): Finanças Core
- [x] Setup infra (repo, Docker Compose, dados mock em JSON)
- [x] Design system (tokens + kit de componentes) — ver [docs/design-system.md](./docs/design-system.md)
- [x] Transações: listar e criar
- [ ] Transações: editar e excluir
- [x] Dashboard (Visão Geral, com calendário "Saídas por dia")
- [x] Relatórios, Patrimônio e Agendadas
- [ ] Relatório por período customizado
- [ ] Autenticação JWT
- [ ] Testes básicos
- [ ] Banco de dados real (PostgreSQL)

### Phase 2: Expansão
- [ ] Múltiplas contas
- [ ] Cartões de crédito
- [ ] WhatsApp + OCR
- [ ] Tarefas integradas

### Phase 3+: Crescimento
- [ ] Previsões inteligentes
- [ ] Integração Google Calendar
- [ ] Gestão de milhas
- [ ] Monetização (SaaS)

## Módulo Negócio

Além do Módulo Finanças (mock em JSON), o PersonOS tem um **Módulo Negócio**, desacoplado do Finanças (pastas e rotas próprias), pensado para no futuro ser vendido separadamente (só Finanças, só Negócio, ou pacote completo).

Diferente do Finanças, o Módulo Negócio guarda os dados em **arquivos Markdown com frontmatter YAML** em vez de JSON — a ideia é que, no futuro, agentes de IA leiam/escrevam esses arquivos diretamente.

### Estrutura

4 páginas, cada uma uma seção estratégica do negócio:

- **Founder** — Objetivo, Estilo de vida
- **Direção** — Mapa do Mercado, Mapa de Problemas, Perfil Ideal de Cliente, Tese de Valor, Oferta
- **Validação** — Oferta, Primeiros Clientes
- **Caixa** — Fluxo de Caixa, ERP

```
backend/
├── data/business/            # Dados mock em Markdown (frontmatter YAML)
│   ├── founder.md
│   ├── direction.md
│   ├── validation.md
│   └── caixa.md
├── app/services/
│   └── business_service.py   # Lê/escreve os .md (via python-frontmatter)
└── app/main.py                # GET/PUT /api/business/{section}

frontend/app/business/
├── layout.tsx                 # Sidebar com links (Founder, Direção, Validação, Caixa)
├── founder/page.tsx
├── direction/page.tsx
├── validation/page.tsx
└── caixa/page.tsx
```

### API

- `GET /api/business/{section}` — retorna os campos da seção (`founder`, `direction`, `validation` ou `caixa`) como JSON.
- `PUT /api/business/{section}` — atualiza os campos da seção (recebe JSON no body) e re-salva o arquivo Markdown correspondente.

Cada página do frontend é um Client Component que busca os dados da seção ao montar e salva as alterações com um botão "Salvar".

## Documentação

- [Design System](./docs/design-system.md)
- [Módulo Negócio — PRD](./docs/business/PRD.md) · [Spec](./docs/business/spec.md) · [Briefing](./docs/business/briefing.md)
- [API Swagger](http://localhost:8000/docs) (quando rodando)

## Contribuição

Projeto pessoal. Feedback da comunidade é bem-vindo.

## Licença

MIT
