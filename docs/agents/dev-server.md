# Servidores de desenvolvimento e verificação

## Antes de dizer "pronto"

Rode `bash scripts/check.sh` (ou `--rapido` para pular o build). Ele roda os critérios de aceite do backend, o lint, o `tsc`, os testes e o build do frontend e, se o backend estiver no ar, confere se ele serve o código atual. O CI (`.github/workflows/check.yml`) roda o mesmo script.

## Backend (porta 8000)

- Sobe pelo **venv**: `backend/start.bat` (`venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`). O `python` global não tem fastapi.
- **Servidor velho é o defeito recorrente.** Os `testa_*.py` usam o `TestClient`, que carrega o código novo, mas o navegador fala com o processo que está na porta. Esse processo pode estar velho de dois jeitos:
  - iniciado sem `--reload`;
  - com o `--reload` travado (a pasta fica no OneDrive). Nesse caso sobra um worker `spawn_main` órfão segurando a porta, e a porta aparece com o PID de um pai que já morreu.
- `backend/scripts/confere_servidor.py` compara as rotas do servidor real com as do código e diz se está velho. `scripts/reinicia-backend.ps1` encerra o uvicorn **e os órfãos** e sobe de novo (`-DryRun` só lista o que encerraria).

## Frontend (porta 3000)

- `frontend/start.bat` (`next dev`). O Next 16 tem mudanças em relação ao que os modelos conhecem: ver `frontend/AGENTS.md`.
- O `npm run build` regenera os tipos de rota em `.next/types`. Se o `tsc` acusar `LayoutRoutes` depois de criar uma rota nova, rode o build e o `tsc` de novo.
