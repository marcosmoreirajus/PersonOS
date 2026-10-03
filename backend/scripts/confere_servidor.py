# -*- coding: utf-8 -*-
"""
Confere se o backend que está rodando (porta 8000) serve o código atual.

Os testes usam o TestClient direto sobre o código, então passam mesmo quando
o servidor de verdade está velho: uma instância antiga sem --reload, ou um
worker órfão do --reload (pasta no OneDrive) segurando a porta. O app no
navegador fala com esse servidor, não com o código — e ninguém percebe.

A conferência é determinística: compara as rotas (path + métodos) do
/openapi.json servido com as de app.main.app.openapi() importado daqui.
Rota nova que não aparece no servidor = servidor desatualizado.

    servidor fora do ar  -> avisa e sai 0 (servidor parado não é erro)
    rotas iguais         -> "servidor atualizado (N rotas)", sai 0
    diferença            -> lista o que falta/sobra, sai 1

Uso:  venv\\Scripts\\python.exe scripts\\confere_servidor.py [--url http://localhost:8000]
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

URL_PADRAO = "http://localhost:8000"
METODOS_HTTP = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def rotas(openapi):
    """Conjunto de (path, MÉTODO) de um documento OpenAPI."""
    saida = set()
    for path, item in (openapi.get("paths") or {}).items():
        for metodo in item:
            if metodo.lower() in METODOS_HTTP:
                saida.add((path, metodo.upper()))
    return saida


def openapi_do_servidor(url):
    """Documento OpenAPI servido, ou None se não há servidor respondendo."""
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/openapi.json", timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
        return None


def openapi_do_codigo():
    from app.main import app  # noqa: E402 — import tardio: só depois do sys.path

    return app.openapi()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Confere se o backend rodando serve o código atual.")
    parser.add_argument("--url", default=URL_PADRAO, help=f"base do servidor (padrão {URL_PADRAO})")
    args = parser.parse_args(argv)
    # Saída redirecionada (check.sh, pipe) usaria cp1252 no Windows e quebraria os acentos.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    servido = openapi_do_servidor(args.url)
    if servido is None:
        print(f"servidor não está rodando em {args.url} — nada a conferir")
        return 0

    no_servidor = rotas(servido)
    no_codigo = rotas(openapi_do_codigo())

    if no_servidor == no_codigo:
        print(f"servidor atualizado ({len(no_codigo)} rotas)")
        return 0

    faltam = sorted(no_codigo - no_servidor)
    sobram = sorted(no_servidor - no_codigo)
    if faltam:
        print("rotas do código que faltam no servidor:")
        for path, metodo in faltam:
            print(f"  {metodo:7} {path}")
    if sobram:
        print("rotas no servidor que não existem mais no código:")
        for path, metodo in sobram:
            print(f"  {metodo:7} {path}")
    print("servidor desatualizado: reinicie com scripts/reinicia-backend.ps1")
    return 1


if __name__ == "__main__":
    sys.exit(main())
