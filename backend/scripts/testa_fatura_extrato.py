# -*- coding: utf-8 -*-
"""
Critérios de aceite da fatura corrigida pelo extrato (issue #28, Fatia 5).
Tudo pela API, com dados isolados num `MemoriaStore`; valores esperados escritos à mão.
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
HOJE = "2026-10-20"


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def ofx(transacoes, fim=None, saldo=None, saldo_em=None):
    """OFX de cartão (SGML). `transacoes`: (AAAAMMDD, valor, descricao)."""
    corpo = "".join(
        f"<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>{d}<TRNAMT>{v}<FITID>{d}{i}<MEMO>{m}</STMTTRN>"
        for i, (d, v, m) in enumerate(transacoes)
    )
    lista = "<BANKTRANLIST><DTSTART>20260801" + (f"<DTEND>{fim}" if fim else "") + corpo + "</BANKTRANLIST>"
    razao = f"<LEDGERBAL><BALAMT>{saldo}<DTASOF>{saldo_em or fim}</LEDGERBAL>" if saldo is not None else ""
    return (
        "OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>"
        "<CURDEF>BRL<CCACCTFROM><ACCTID>9999</CCACCTFROM>" + lista + razao + "</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>"
    ).encode()


def main_testes():
    cli = TestClient(app)

    def post(url, **kw):
        return cli.post(url, **kw)

    def importa(conteudo, card_id, nome="fatura.ofx"):
        return cli.post("/api/import/commit", files={"file": (nome, conteudo)}, data={"user_id": UID, "card_id": card_id})

    def compra(card_id, dia, valor, desc="Compra"):
        r = post("/api/transactions", json={"user_id": UID, "category_id": 1, "type": "expense", "amount": valor, "description": desc,
                                           "due_date": dia, "settled_at": dia, "source": "manual", "card_id": card_id})
        assert r.status_code == 200, r.text

    def fatura(card_id, ciclo):
        r = cli.get(f"/api/cards/{card_id}/invoices", params={"hoje": HOJE})
        return next((f for f in r.json()["data"] if f["cycle"] == ciclo), None)

    def edita(card_id, ciclo, **corpo):
        return cli.patch(f"/api/cards/{card_id}/invoices/{ciclo}", params={"hoje": HOJE}, json=corpo)

    def decide(card_id, ciclo, decisao):
        return post(f"/api/cards/{card_id}/invoices/{ciclo}/total-decision", params={"hoje": HOJE}, json={"decision": decisao})

    def fila():
        return cli.get(f"/api/review/user/{UID}").json()["data"]

    nubank = post("/api/cards", json={"user_id": UID, "name": "Nubank", "limit": 5000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    compra(nubank, "2026-08-10", 300, "Mercado")
    compra(nubank, "2026-08-20", 100, "Posto")

    print("edição à mão de fechamento e vencimento")
    f0 = fatura(nubank, "2026-08")
    checa("antes de corrigir, valem as datas calculadas (25/08 e 05/09)", f0["closing_date"] == "2026-08-25" and f0["due_date"] == "2026-09-05", str(f0))
    r = edita(nubank, "2026-08", closing_date="2026-08-27", due_date="2026-09-07")
    checa("editar responde 200", r.status_code == 200, r.text[:160])
    f1 = fatura(nubank, "2026-08")
    checa("a lista passa a mostrar 27/08 e 07/09", f1["closing_date"] == "2026-08-27" and f1["due_date"] == "2026-09-07", str(f1))
    checa("o total continua a soma das compras (400)", f1["total"] == 400.0, str(f1))
    checa("as compras continuam no mesmo ciclo (2 compras)", f1["purchases_count"] == 2)
    d = cli.get(f"/api/cards/{nubank}/invoices/2026-08", params={"hoje": HOJE}).json()["data"]
    checa("o detalhe também mostra a data corrigida", d["closing_date"] == "2026-08-27" and d["due_date"] == "2026-09-07")
    base = fila()["total"]
    edita(nubank, "2026-08", closing_date=None)
    checa("null apaga a correção do fechamento (volta a 25/08) e mantém o vencimento corrigido",
          fatura(nubank, "2026-08")["closing_date"] == "2026-08-25" and fatura(nubank, "2026-08")["due_date"] == "2026-09-07")
    edita(nubank, "2026-08", due_date=None)
    checa("sem nenhuma correção, a fatura volta ao calculado", fatura(nubank, "2026-08")["due_date"] == "2026-09-05")

    print("total declarado diferente da soma das compras")
    checa("sem total declarado não há item em A revisar", fila()["diferencas_fatura"] == [], str(fila()["diferencas_fatura"]))
    r = edita(nubank, "2026-08", declared_total=400.0)
    checa("total igual à soma não gera item", r.status_code == 200 and fila()["diferencas_fatura"] == [])
    r = edita(nubank, "2026-08", declared_total=450.0)
    f2 = fatura(nubank, "2026-08")
    checa("a fatura mostra o total declarado e a diferença (+50)", f2["declared_total"] == 450.0 and f2["difference"] == 50.0, str(f2))
    checa("o total segue a soma das compras (400): nada é corrigido em silêncio", f2["total"] == 400.0 and f2["remaining"] == 400.0, str(f2))
    q = fila()
    item = q["diferencas_fatura"][0] if q["diferencas_fatura"] else {}
    checa("aparece em A revisar com cartão, ciclo, total do extrato, soma e diferença",
          len(q["diferencas_fatura"]) == 1 and item.get("card_name") == "Nubank" and item.get("cycle") == "2026-08"
          and item.get("declared_total") == 450.0 and item.get("purchases_total") == 400.0 and item.get("difference") == 50.0, str(item))
    checa("o contador da navegação (total da fila) inclui o item", q["total"] == base + 1, "%s -> %s" % (base, q["total"]))
    r = decide(nubank, "2026-08", "extract")
    f3 = fatura(nubank, "2026-08")
    checa("aceitar o total do extrato faz a fatura valer 450 e some da fila", r.status_code == 200 and f3["total"] == 450.0 and f3["remaining"] == 450.0
          and fila()["diferencas_fatura"] == [], str(f3))
    r = decide(nubank, "2026-08", "purchases")
    f4 = fatura(nubank, "2026-08")
    checa("manter a soma das compras volta a 400 e continua fora da fila", r.status_code == 200 and f4["total"] == 400.0 and fila()["diferencas_fatura"] == [], str(f4))
    edita(nubank, "2026-08", declared_total=470.0)
    checa("um novo total declarado reabre a pergunta", len(fila()["diferencas_fatura"]) == 1 and fatura(nubank, "2026-08")["difference"] == 70.0)
    compra(nubank, "2026-08-22", 70, "Compra que faltava")
    checa("importar a compra que faltava zera a diferença e tira da fila", fila()["diferencas_fatura"] == [] and fatura(nubank, "2026-08")["difference"] == 0.0)
    edita(nubank, "2026-08", declared_total=None)
    checa("apagar o total declarado limpa a diferença", fatura(nubank, "2026-08")["declared_total"] is None and fatura(nubank, "2026-08")["difference"] is None)

    print("datas e total lidos do OFX do cartão")
    inter = post("/api/cards", json={"user_id": UID, "name": "Inter", "limit": 3000, "closing_day": 25, "due_day": 5}).json()["data"]["id"]
    arquivo = ofx([("20260810", "-300.00", "Mercado"), ("20260820", "-100.00", "Posto")], fim="20260827", saldo="-450.00", saldo_em="20260906")
    r = importa(arquivo, inter)
    checa("a importação responde 200", r.status_code == 200, r.text[:200])
    g = fatura(inter, "2026-08")
    checa("o fechamento do arquivo (27/08) corrige o calculado (25/08)", g and g["closing_date"] == "2026-08-27", str(g))
    checa("o vencimento do arquivo (06/09) corrige o calculado (05/09)", g and g["due_date"] == "2026-09-06", str(g))
    checa("o total do arquivo (450) fica declarado, e a soma das compras (400) continua sendo o total",
          g and g["declared_total"] == 450.0 and g["total"] == 400.0 and g["difference"] == 50.0, str(g))
    checa("a correção vem marcada como lida do arquivo", g and g["corrected"] == ["closing_date", "declared_total", "due_date"], str(g))
    itens = fila()["diferencas_fatura"]
    checa("a diferença de 50 vai para A revisar (Inter, agosto)", len(itens) == 1 and itens[0]["card_name"] == "Inter" and itens[0]["difference"] == 50.0, str(itens))
    importa(arquivo, inter)
    checa("reimportar o mesmo arquivo não duplica compras nem item", fatura(inter, "2026-08")["purchases_count"] == 2 and len(fila()["diferencas_fatura"]) == 1)
    edita(inter, "2026-08", closing_date="2026-08-28")
    importa(ofx([("20260810", "-300.00", "Mercado")], fim="20260827"), inter)
    checa("o que o usuário editou à mão não é sobrescrito por um arquivo depois", fatura(inter, "2026-08")["closing_date"] == "2026-08-28")
    importa(ofx([("20260810", "-300.00", "Mercado")], fim="20260812", saldo="-1.00"), inter)
    checa("data de fim longe de qualquer fechamento do cartão é ignorada (total idem)", fatura(inter, "2026-08")["declared_total"] == 450.0)
    r = importa(ofx([("20260910", "-80.00", "Farmácia")], fim="20260925", saldo="-80.00", saldo_em="20260925"), inter)
    s = fatura(inter, "2026-09")
    checa("total igual à soma não gera item; DTASOF não depois do fim não vira vencimento",
          s and s["closing_date"] == "2026-09-25" and s["due_date"] == "2026-10-05" and s["difference"] == 0.0 and len(fila()["diferencas_fatura"]) == 1, str(s))
    csv = ("data;descricao;valor\n10/09/2026;Cinema;-40,00\n").encode()
    r = cli.post("/api/import/commit", files={"file": ("extrato.csv", csv)}, data={"user_id": UID, "card_id": inter})
    checa("CSV não traz fechamento nem total: nada é corrigido", r.status_code == 200 and fatura(inter, "2026-09")["declared_total"] == 80.0 and fatura(inter, "2026-09")["total"] == 120.0)
    checa("e agora a fatura de setembro difere (80 declarado x 120 em compras): novo item", len(fila()["diferencas_fatura"]) == 2)

    print("validações")
    checa("data malformada é recusada (400)", edita(nubank, "2026-08", closing_date="27/08").status_code == 400)
    checa("fechamento longe do ciclo é recusado (400)", edita(nubank, "2026-08", closing_date="2026-10-01").status_code == 400)
    checa("vencimento antes do fechamento é recusado (400)", edita(nubank, "2026-08", due_date="2026-08-20").status_code == 400)
    checa("total negativo é recusado (400)", edita(nubank, "2026-08", declared_total=-1).status_code == 400)
    checa("ciclo sem compras é 404", edita(nubank, "2025-01", declared_total=10).status_code == 404)
    checa("ciclo malformado é 400", edita(nubank, "agosto", declared_total=10).status_code == 400)
    checa("cartão inexistente é 404", edita(999, "2026-08", declared_total=10).status_code == 404)
    checa("decidir sem total declarado é recusado (400)", decide(nubank, "2026-08", "extract").status_code == 400)


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
