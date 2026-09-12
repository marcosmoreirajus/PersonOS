# PersonOS

Sistema integrado de gestão pessoal para indivíduos e casais com renda diversificada (PJ + PF).

**Tagline:** Tudo-em-um pronto pra usar: finanças, tarefas, metas, agenda e milhas — sem customização demorada.

## Stack

- **Backend:** Python 3.11+ + FastAPI + PostgreSQL
- **Frontend:** Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- **Infra:** Docker Compose (dev), Railway/Render (prod)

## MVP 1.0 — Escopo

- ✅ Gestão de finanças pessoal/casal (entrada + dashboard + relatório)
- ✅ Autenticação JWT
- ✅ Swagger (doc API)
- ✅ Testes básicos

**Timeline:** 3-4 semanas

## Estrutura

```
PersonOS/
├── backend/           # FastAPI
│   ├── app/
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── api/       # Routes
│   │   ├── services/  # Business logic
│   │   ├── main.py
│   │   ├── config.py
│   │   └── database.py
│   ├── requirements.txt
│   ├── .env.example
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
- [ ] Setup infra (repo, Docker, models)
- [ ] CRUD de transações
- [ ] Dashboard
- [ ] Relatórios simples

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

## Documentação

- [Planejamento Técnico](./docs/PLANNING.md) (em desenvolvimento)
- [PRD](./docs/PRD.md) (em desenvolvimento)
- [API Swagger](http://localhost:8000/docs) (quando rodando)

## Contribuição

Projeto pessoal. Feedback da comunidade é bem-vindo.

## Licença

MIT
