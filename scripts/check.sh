#!/usr/bin/env bash
# Verificação completa do PersonOS — um comando só, o mesmo no CI e na máquina.
#
#   bash scripts/check.sh          # tudo
#   bash scripts/check.sh --rapido # pula o build do Next (o passo mais lento)
#
# Para no primeiro passo vermelho e diz qual foi. Antes disto as checagens
# existiam soltas (tsc, npm test, build, os testa_*.py) e nada as rodava
# juntas: dava para commitar com tudo vermelho.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
RAPIDO=0
[ "${1:-}" = "--rapido" ] && RAPIDO=1

# Python: o venv do backend na máquina (o python global não tem fastapi);
# no CI, o que a variável PYTHON apontar.
if [ -n "${PYTHON:-}" ]; then
  PY="$PYTHON"
elif [ -x "$RAIZ/backend/venv/Scripts/python.exe" ]; then
  PY="$RAIZ/backend/venv/Scripts/python.exe"
elif [ -x "$RAIZ/backend/venv/bin/python" ]; then
  PY="$RAIZ/backend/venv/bin/python"
else
  echo "Python do backend não encontrado: crie backend/venv ou defina PYTHON." >&2
  exit 1
fi
export PYTHONIOENCODING=utf-8

passo() { printf '\n== %s\n' "$1"; }
falhou() { printf '\nFALHOU: %s\n' "$1" >&2; exit 1; }

passo "backend: critérios de aceite (backend/scripts/testa_*.py)"
for s in "$RAIZ"/backend/scripts/testa_*.py; do
  nome="$(basename "$s")"
  # Os scripts imprimem "FALHA" por critério e saem com 1 no fim.
  "$PY" "$s" > /tmp/personos-check.log 2>&1 || { cat /tmp/personos-check.log; falhou "$nome"; }
  echo "  ok  $nome"
done

cd "$RAIZ/frontend"
passo "frontend: lint (eslint)";        npx eslint . || falhou "lint"
passo "frontend: tipos (tsc)";          npx tsc --noEmit || falhou "tsc"
passo "frontend: testes (node --test)"; npm test --silent || falhou "testes do frontend"
if [ "$RAPIDO" = 0 ]; then
  passo "frontend: build (next build)"; npm run build --silent > /tmp/personos-build.log 2>&1 \
    || { tail -40 /tmp/personos-build.log; falhou "build"; }
  echo "  ok  build"
fi

# Só na máquina: se o backend estiver rodando, confere se ele serve o código
# atual. O TestClient dos critérios carrega o código novo; o servidor que o
# navegador usa pode estar velho (aconteceu duas vezes em 02/10).
if [ -z "${CI:-}" ] && [ -f "$RAIZ/backend/scripts/confere_servidor.py" ]; then
  passo "backend: servidor rodando está atualizado?"
  (cd "$RAIZ/backend" && "$PY" scripts/confere_servidor.py) || falhou "servidor desatualizado"
fi

printf '\nTudo verde.\n'
