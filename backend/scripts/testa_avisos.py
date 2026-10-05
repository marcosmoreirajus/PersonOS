# -*- coding: utf-8 -*-
"""
Preferências dos avisos do sino (issue #2), verificadas sobre o MemoriaStore
semeado com os dados de exemplo — nenhum arquivo é tocado.

O backend só guarda e devolve: quais avisos ficam ligados, a janela do
"a vencer" e o conjunto visto. Derivar os avisos é do front, que sabe qual é
o "hoje" local (ver lib/dates.ts) — o servidor não.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services.data_service import DataService  # noqa: E402
from app.services.store import usar_store  # noqa: E402
from suporte_testes import store_com_dados_de_exemplo  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def main():
    # Dados de exemplo em memória, sem preferências: nada vai ao disco.
    store = store_com_dados_de_exemplo(sem=("preferences",))
    usar_store(store)
    print("dados de teste em memória")
    print()

    print("Serviço")
    padrao = DataService.get_preferences(1)
    checa("sem preferência gravada, valem os padrões",
          padrao == {"user_id": 1, "em_atraso": True, "a_vencer": True, "janela_a_vencer": 7, "visto": []},
          str(padrao))
    checa("ler não grava nada", store.load("preferences") == [])

    p = DataService.update_preferences(1, {"janela_a_vencer": 3})
    checa("gravação parcial muda só o campo enviado", p["janela_a_vencer"] == 3 and p["a_vencer"] is True, str(p))

    visto = [{"aviso": "em_atraso", "transaction_id": 4}, {"aviso": "a_vencer", "transaction_id": 9}]
    DataService.update_preferences(1, {"visto": visto})
    p = DataService.update_preferences(1, {"a_vencer": False})
    checa("mudar a configuração não apaga o visto", p["visto"] == visto and p["a_vencer"] is False, str(p))
    checa("visto é substituído, não acumulado",
          DataService.update_preferences(1, {"visto": visto[:1]})["visto"] == visto[:1])
    checa("persiste entre leituras", DataService.get_preferences(1)["janela_a_vencer"] == 3)
    checa("preferência é por usuário", DataService.get_preferences(2)["janela_a_vencer"] == 7)
    checa("um registro por usuário",
          len([r for r in DataService.load_json("preferences") if r["user_id"] == 1]) == 1)

    print()
    print("API")
    from fastapi.testclient import TestClient  # noqa: E402
    from app.main import app  # noqa: E402

    cli = TestClient(app)
    r = cli.get("/api/preferences/user/5")
    checa("GET devolve os padrões", r.status_code == 200 and r.json()["data"]["janela_a_vencer"] == 7, r.text)
    r = cli.patch("/api/preferences/user/5", json={"janela_a_vencer": 15, "em_atraso": False})
    checa("PATCH grava parcial", r.status_code == 200 and r.json()["data"]["janela_a_vencer"] == 15
          and r.json()["data"]["em_atraso"] is False and r.json()["data"]["a_vencer"] is True, r.text)
    r = cli.patch("/api/preferences/user/5", json={"janela_a_vencer": 5})
    checa("janela fora de 0/1/3/7/15 é recusada", r.status_code == 422, str(r.status_code))
    r = cli.patch("/api/preferences/user/5", json={"visto": [{"aviso": "sem_categoria", "transaction_id": 1}]})
    checa("visto só aceita avisos de prazo", r.status_code == 422, str(r.status_code))
    r = cli.patch("/api/preferences/user/5", json={"visto": [{"aviso": "a_vencer", "transaction_id": 1}]})
    checa("PATCH do visto", r.status_code == 200 and r.json()["data"]["visto"] == [{"aviso": "a_vencer", "transaction_id": 1}])
    r = cli.patch("/api/preferences/user/5", json={"user_id": 1, "janela_a_vencer": 1})
    checa("o corpo não troca o dono", r.status_code == 200 and r.json()["data"]["user_id"] == 5
          and DataService.get_preferences(1)["janela_a_vencer"] == 3)

    print()
    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
