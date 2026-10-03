# PersonOS — instruções para agentes

## Verificação

Antes de dizer que algo está pronto, rode `bash scripts/check.sh`. Se o backend responder 404 numa rota nova, a causa provável é servidor velho. Ver `docs/agents/dev-server.md`.

## Agent skills

### Issue tracker

As issues ficam no GitHub Issues de `marcosmoreirajus/PersonOS`, acessadas pelo `gh` CLI. Ver `docs/agents/issue-tracker.md`.

### Triage labels

São os cinco labels padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` e `wontfix`. Ver `docs/agents/triage-labels.md`.

### Domain docs

Layout single-context, com `GLOSSARY.md` e `docs/adr/` na raiz (criados só quando precisar). Ver `docs/agents/domain.md`.
