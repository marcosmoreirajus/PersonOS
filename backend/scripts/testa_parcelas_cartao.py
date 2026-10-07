# -*- coding: utf-8 -*-
"""
Critérios de aceite das parcelas no ciclo do cartão (issue #30, Fatia 5).
Tudo pela API, com dados isolados num `MemoriaStore`; valores esperados escritos à mão.
Fora do escopo: recorrência no cartão, estorno (#31), fatura corrigida pelo extrato (#28).
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []
UID = 1
HOJE = "2026-10-06"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def csv(*linhas):
    return ("data;descricao;valor\n" + "".join(l + "\n" for l in linhas)).encode()


def main_testes():
    cli = TestClient(app)

    def parcelado(card_id, dia, total, n, desc="Geladeira", **extra):
        corpo = {"user_id": UID, "category_id": 1, "type": "expense", "amount": total, "description": desc,
                 "due_date": dia, "source": "manual", "card_id": card_id,
                 "series": {"kind": "installment", "frequency": "monthly", "total_count": n}}
        corpo.update(extra)
        return cli.post("/api/transactions", json=corpo)

    def parcelas_da_serie(serie_id):
        todas = cli.get(f"/api/transactions/user/{UID}").json()["data"]
        return sorted([t for t in todas if t.get("series_id") == serie_id], key=lambda t: t["due_date"])

    def faturas(card_id):
        r = cli.get(f"/api/cards/{card_id}/invoices", params={"hoje": HOJE})
        return {f["cycle"]: f for f in r.json()["data"]}

    def despesa(de, ate):
        r = cli.get(f"/api/reports/summary/{UID}", params={"hoje": ate, "periodo": "personalizado", "de": de, "ate": ate})
        return r.json()["data"]["despesa"]["valor"]

    nubank = cli.post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 9000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]

    print("parcelado no cartão é uma série com o Cartão como destino")
    r = parcelado(nubank, "2026-10-10", 1200, 12)
    checa("1.200 em 12x no cartão é aceito (200)", r.status_code == 200, r.text[:200])
    serie_id = r.json()["data"]["series_id"] if r.status_code == 200 else None
    ps = parcelas_da_serie(serie_id)
    checa("geram 12 parcelas de 100", len(ps) == 12 and all(p["amount"] == 100.0 for p in ps), str([p["amount"] for p in ps]))
    checa("todas apontam o cartão e nenhuma tem conta", all(p.get("card_id") == nubank and p.get("account_id") is None for p in ps))
    checa("nascem previstas (sem efetivação)", all(p["settled_at"] is None for p in ps))
    serie = next((s for s in cli.get(f"/api/series/user/{UID}").json()["data"] if s["id"] == serie_id), {})
    checa("a série guarda o card_id", serie.get("card_id") == nubank, str(serie))

    print("divisão do total: trunca e a sobra vai para a primeira")
    r = parcelado(nubank, "2026-10-10", 100, 7, "Tênis")
    ps7 = parcelas_da_serie(r.json()["data"]["series_id"])
    checa("100 em 7x: primeira 14,32 e as outras seis 14,28", [p["amount"] for p in ps7] == [14.32] + [14.28] * 6, str([p["amount"] for p in ps7]))

    print("o cartão só aceita parcelado")
    r = cli.post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": 40, "description": "Streaming",
                                            "due_date": "2026-10-10", "source": "manual", "card_id": nubank,
                                            "series": {"kind": "recurring", "frequency": "monthly"}})
    checa("recorrência no cartão continua recusada (400)", r.status_code == 400, r.text[:160])
    r = parcelado(nubank, "2026-10-10", 100, 3, account_id=1)
    checa("parcelado com conta e cartão juntos é recusado (400)", r.status_code == 400, r.text[:160])
    r = parcelado(9999, "2026-10-10", 100, 3)
    checa("parcelado em cartão que não existe é recusado (400)", r.status_code == 400, r.text[:160])

    print("cada parcela cai na fatura do ciclo da data dela")
    # Fechamento dia 25. Parcelas de 10/10/2026 a 10/09/2027, dia 10: cada uma no ciclo do próprio mês.
    f = faturas(nubank)
    esperado = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09"]
    checa("a Geladeira aparece em 12 ciclos consecutivos, um por parcela", all(c in f for c in esperado), str(sorted(f)))
    checa("outubro soma Geladeira 100 + Tênis 14,32", f["2026-10"]["total"] == 114.32, str(f["2026-10"]["total"]))
    checa("novembro soma Geladeira 100 + Tênis 14,28", f["2026-11"]["total"] == 114.28, str(f["2026-11"]["total"]))
    checa("setembro de 2027 só tem a última Geladeira (100)", f["2027-09"]["total"] == 100.0, str(f["2027-09"]["total"]))
    det = cli.get(f"/api/cards/{nubank}/invoices/2026-11", params={"hoje": HOJE}).json()["data"]
    geladeira = next(p for p in det["purchases"] if p["description"] == "Geladeira")
    checa("a fatura mostra a parcela como 2/12, ainda prevista", geladeira.get("installment") == {"index": 2, "count": 12} and geladeira.get("predicted") is True, str(geladeira))

    print("despesa do mês: previsto fora; efetivada, na data da própria parcela")
    checa("parcelas previstas não entram na despesa de outubro", despesa("2026-10-01", "2026-10-31") == 0, str(despesa("2026-10-01", "2026-10-31")))
    cartao_b = cli.post("/api/cards", json={"user_id": UID, "name": "Inter", "limit": 3000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    r = parcelado(cartao_b, "2027-01-15", 1200, 12, "Notebook")
    pb = parcelas_da_serie(r.json()["data"]["series_id"])
    checa("12x gera uma parcela por mês, de janeiro/2027 a dezembro/2027", [p["due_date"][:7] for p in pb] ==
          ["2027-%02d" % m for m in range(1, 13)], str([p["due_date"][:7] for p in pb]))
    fb = faturas(cartao_b)
    checa("uma fatura por ciclo, cada uma com a parcela de 100", sorted(fb) == ["2027-%02d" % m for m in range(1, 13)]
          and all(f["total"] == 100.0 and f["purchases_count"] == 1 for f in fb.values()), str({c: f["total"] for c, f in fb.items()}))
    for p in pb:
        r = cli.post(f"/api/transactions/{p['id']}/settle", json={"on": p["due_date"]})
        assert r.status_code == 200, r.text
    checa("efetivadas, cada mês de 2027 tem 100 de despesa (e só ela)",
          all(despesa("2027-%02d-01" % m, "2027-%02d-28" % m) == 100.0 for m in range(1, 13)),
          str([despesa("2027-%02d-01" % m, "2027-%02d-28" % m) for m in range(1, 13)]))
    checa("o ano inteiro soma 1.200 e a Geladeira, ainda prevista, não entra", despesa("2027-01-01", "2027-12-31") == 1200.0)

    print("importação do extrato do cartão: a parcela prevista vira realizada, sem duplicar")

    def envia(rota, conteudo, **campos):
        return cli.post("/api/import/" + rota, files={"file": ("fatura.csv", conteudo)}, data={"user_id": UID, "card_id": nubank, **campos})

    antes = len(cli.get(f"/api/transactions/user/{UID}").json()["data"])
    extrato = csv("11/11/2026;GELADEIRA PARC 02/12;-100,00", "12/11/2026;Padaria;-30,00")
    p = envia("preview", extrato).json()["data"]
    por_desc = {l["descricao"]: l for l in p["linhas"]}
    gel = por_desc["GELADEIRA PARC 02/12"]
    checa("a linha do extrato é suspeita e o candidato é a parcela 2 de novembro, ainda prevista",
          gel["situacao"] == "suspeita" and gel["candidato"]["data"] == "2026-11-10" and gel["candidato"]["settled"] is False, str(gel))
    checa("a outra linha é nova", por_desc["Padaria"]["situacao"] == "nova")
    d = envia("commit", extrato, decisoes='{"%s": "merge"}' % gel["import_hash"]).json()["data"]
    checa("o commit concilia 1 e importa 1", d["conciliadas"] == 1 and d["importadas"] == 1, str(d))
    depois = cli.get(f"/api/transactions/user/{UID}").json()["data"]
    checa("não duplicou: só a Padaria é lançamento novo", len(depois) == antes + 1, "%d -> %d" % (antes, len(depois)))
    parcela2 = next(t for t in parcelas_da_serie(serie_id) if t["series_index"] == 2)
    checa("a parcela 2 ficou efetivada na data do extrato, sem perder a série",
          parcela2["settled_at"] == "2026-11-11" and parcela2["series_id"] == serie_id and parcela2["card_id"] == nubank, str(parcela2))
    det = cli.get(f"/api/cards/{nubank}/invoices/2026-11", params={"hoje": HOJE}).json()["data"]
    gel2 = next(x for x in det["purchases"] if x["description"] == "Geladeira")
    checa("na fatura a parcela 2/12 já não é prevista", gel2["installment"] == {"index": 2, "count": 12} and gel2["predicted"] is False, str(gel2))
    checa("novembro tem Geladeira 100 + Tênis 14,28 + Padaria 30 = 144,28", det["total"] == 144.28, str(det["total"]))
    novamente = envia("preview", extrato).json()["data"]
    checa("reimportar o mesmo arquivo não oferece nada de novo", novamente["contagem"].get("nova", 0) == 0 and novamente["contagem"].get("suspeita", 0) == 0, str(novamente["contagem"]))


def main():
    anterior = usar_store(MemoriaStore())
    try:
        main_testes()
    finally:
        usar_store(anterior)

    print()
    if falhas:
        print("FALHARAM %d: %s" % (len(falhas), "; ".join(falhas)))
        sys.exit(1)
    print("todos os critérios passaram")


if __name__ == "__main__":
    main()
