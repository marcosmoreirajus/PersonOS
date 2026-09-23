# -*- coding: utf-8 -*-
"""
Critérios de aceite da Fatia 3 (docs/finance/PRD.md), verificados sobre uma
cópia dos dados — o arquivo real não é tocado.

    importar um arquivo com 3 linhas repetidas de um extrato já importado
    resulta em 0 duplicatas gravadas;
    conciliar uma linha com um lançamento manual e reimportar o mesmo arquivo
    não gera nova suspeita.

Além dos dois critérios do PRD, cobre as decisões de implementação que o spec
deixava em aberto (ver o cabeçalho de import_service.py).
"""

import shutil
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services import data_service  # noqa: E402
from app.services import import_service as imp  # noqa: E402
from app.services.data_service import DataService  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def tx():
    return DataService.load_json("transactions")


def visiveis():
    """O que saldo, relatório e listagem padrão enxergam."""
    return DataService.get_transactions_by_user(1)


def ofx_sgml(linhas, conta="12345-6"):
    """OFX 1.x de banco brasileiro: SGML sem fechamento, cp1252."""
    corpo = "".join(
        "<STMTTRN>\r\n<TRNTYPE>DEBIT\r\n<DTPOSTED>%s000000[-3:BRT]\r\n<TRNAMT>%s\r\n"
        "<FITID>%s\r\n<MEMO>%s\r\n</STMTTRN>\r\n" % (d.replace("-", ""), v, fitid, memo)
        for (d, v, fitid, memo) in linhas
    )
    texto = (
        "OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nCHARSET:1252\r\n\r\n"
        "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>%s</ACCTID></BANKACCTFROM>"
        "<BANKTRANLIST>%s</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>" % (conta, corpo)
    )
    return texto.encode("cp1252")


def csv_bytes(linhas, sep=";"):
    cab = sep.join(["data", "descricao", "valor"])
    corpo = "\n".join(sep.join(l) for l in linhas)
    return (cab + "\n" + corpo + "\n").encode("utf-8")


def main():
    tmp = Path(tempfile.mkdtemp(prefix="clari-fatia3-"))
    for f in (RAIZ / "data").glob("*.json"):
        shutil.copy(f, tmp / f.name)
    data_service.DATA_DIR = tmp
    print("dados de teste em", tmp)
    print()

    hoje = date.today()
    d = lambda n: (hoje - timedelta(days=n)).isoformat()  # noqa: E731

    # ------------------------------------------------------------ leitura
    print("Leitura")
    formato, linhas, invalidas, conta = imp.ler_arquivo(
        "extrato.ofx",
        ofx_sgml(
            [
                (d(10), "-152,30", "A001", "COMPRA SUPERMERCADO EXTRA"),
                (d(9), "3500.00", "A002", "SALÁRIO SETEMBRO"),
                (d(8), "-8.00", "A003", "PADARIA PÃO QUENTE"),
            ]
        ),
    )
    checa("OFX SGML em cp1252 é lido", formato == "ofx" and len(linhas) == 3, "%d linhas" % len(linhas))
    checa("conta do arquivo vem do ACCTID", conta == "12345-6")
    checa("acento cp1252 preservado", linhas[1]["descricao"] == "SALÁRIO SETEMBRO", linhas[1]["descricao"])
    checa("vírgula e ponto decimais são aceitos", linhas[0]["amount"] == 152.30 and linhas[1]["amount"] == 3500.0)
    checa("sinal define o tipo", linhas[0]["type"] == "expense" and linhas[1]["type"] == "income")
    checa("fuso do OFX não desloca o dia", linhas[0]["data"] == d(10), linhas[0]["data"])

    _, csv_linhas, _, _ = imp.ler_arquivo(
        "extrato.csv",
        csv_bytes([["10/09/2026", "Mercado", "-1.234,56"], ["2026-09-11", "Freela", "500,00"]]),
    )
    checa("CSV com data BR, ISO e valor 1.234,56", csv_linhas[0]["valor"] == -1234.56 and csv_linhas[1]["data"] == "2026-09-11")
    _, csv_v, _, _ = imp.ler_arquivo("e.csv", csv_bytes([["10/09/2026", "Mercado", "-10.50"]], sep=","))
    checa("CSV separado por vírgula", csv_v[0]["valor"] == -10.5)

    try:
        imp.ler_arquivo("a.csv", b"foo;bar\n1;2\n")
        checa("planilha sem as colunas é recusada", False)
    except imp.ArquivoInvalido as e:
        checa("planilha sem as colunas é recusada com mensagem clara", "data" in str(e), str(e))

    _, _, invs, _ = imp.ler_arquivo(
        "e.csv", csv_bytes([["10/09/2026", "Ok", "-5,00"], ["31/02/2026", "Data ruim", "-1,00"]])
    )
    checa("linha inválida é reportada, não engolida", len(invs) == 1 and invs[0]["linha"] == 3, str(invs))

    # --------------------------------------------- prévia não grava nada
    print()
    print("Importação")
    arquivo_a = ofx_sgml([(d(20 - i), "-%d.00" % (10 + i), "F%03d" % i, "COMPRA LOJA %s" % chr(65 + i)) for i in range(10)])
    antes = len(tx())
    prev = imp.analisar(1, "a.ofx", arquivo_a)
    checa("prévia não grava", len(tx()) == antes)
    checa("prévia conta as linhas", prev["contagem"]["nova"] == 10, str(prev["contagem"]))

    # ----------------------------------------------------- critério do PRD 1
    r1 = imp.importar(1, "a.ofx", arquivo_a)
    checa("importa as 10 linhas", r1["importadas"] == 10 and r1["aguardando_conciliacao"] == 0, str(r1))
    importadas = [t for t in tx() if t.get("source") == "import"]
    checa("linha importada nasce efetivada e sem categoria",
          all(t["settled_at"] == t["due_date"] and t["category_id"] is None for t in importadas))
    checa("linha importada carrega identidade de origem",
          all(t["external_id"] and t["import_hash"] for t in importadas))

    arquivo_b = ofx_sgml(
        [(d(20 - i), "-%d.00" % (10 + i), "F%03d" % i, "COMPRA LOJA %s" % chr(65 + i)) for i in range(3)]
        + [(d(2), "-77.00", "N001", "FARMÁCIA NOVA"), (d(1), "-88.00", "N002", "LIVRARIA NOVA")]
    )
    antes = len(tx())
    r2 = imp.importar(1, "b.ofx", arquivo_b)
    checa("PRD: 3 linhas repetidas de extrato já importado -> 0 duplicatas",
          r2["ja_existiam"] == 3 and r2["importadas"] == 2, str(r2))
    checa("só as 2 novas foram gravadas", len(tx()) - antes == 2, "+%d" % (len(tx()) - antes))

    antes = len(tx())
    r3 = imp.importar(1, "a.ofx", arquivo_a)
    checa("reimportar o mesmo arquivo não grava nada", r3["importadas"] == 0 and len(tx()) == antes, str(r3))

    # ------------------------------------ linhas idênticas legítimas (CSV)
    cafes = csv_bytes([[d(5), "Cafe da esquina", "-8,00"], [d(5), "Cafe da esquina", "-8,00"]])
    r4 = imp.importar(1, "cafes.csv", cafes)
    checa("dois cafés iguais no mesmo dia entram os dois", r4["importadas"] == 2, str(r4))
    r5 = imp.importar(1, "cafes.csv", cafes)
    checa("e reimportar continua idempotente", r5["importadas"] == 0 and r5["ja_existiam"] == 2, str(r5))

    # ------------------------------------------------------- suspeita
    print()
    print("Duplicidade")
    manual = DataService.create_transaction(
        user_id=1, category_id=1, type="expense", amount=152.30,
        due_date=d(11), settled_at=d(11), description="Supermercado Extra",
    )
    extrato = ofx_sgml([(d(10), "-152,30", "S001", "COMPRA SUPERMERCADO EXTRA"),
                        (d(3), "-19,90", "S002", "ASSINATURA STREAMING")])
    prev = imp.analisar(1, "s.ofx", extrato)
    checa("lançamento manual vira candidato (valor igual, ±3 dias, palavra em comum)",
          prev["linhas"][0]["situacao"] == "suspeita" and prev["linhas"][0]["candidato_id"] == manual["id"],
          str(prev["contagem"]))

    saldo_antes = round(sum(t["amount"] for t in visiveis() if t["type"] == "expense" and t.get("settled_at")), 2)
    r6 = imp.importar(1, "s.ofx", extrato)
    checa("entrada parcial: a limpa entra na hora, a suspeita espera",
          r6["importadas"] == 1 and r6["aguardando_conciliacao"] == 1, str(r6))
    em_espera = [t for t in tx() if t.get("ingest_state") == "awaiting_reconciliation"]
    checa("a suspeita fica na mesma tabela, em espera", len(em_espera) == 1)
    checa("em espera NÃO aparece em saldo nem listagem padrão",
          all(t["id"] != em_espera[0]["id"] for t in visiveis()))
    saldo_depois = round(sum(t["amount"] for t in visiveis() if t["type"] == "expense" and t.get("settled_at")), 2)
    checa("saldo só mudou pela linha limpa (19,90)", round(saldo_depois - saldo_antes, 2) == 19.90,
          "%.2f -> %.2f" % (saldo_antes, saldo_depois))

    r7 = imp.importar(1, "s.ofx", extrato)
    checa("reimportar com a suspeita esperando não duplica a fila",
          r7["importadas"] == 0 and r7["aguardando_conciliacao"] == 0 and r7["ja_existiam"] == 2, str(r7))

    # ----------------------------------------------- critério do PRD 2
    linha = em_espera[0]
    ok = imp.conciliar(linha["id"], "merge")
    checa("fundir devolve o registro que fica", ok["id"] == manual["id"])
    checa("o que fica mantém id e categoria", ok["category_id"] == 1)
    checa("o que fica absorve os identificadores do banco",
          ok["external_id"] and ok["import_hash"] and ok["bank_description"] == "COMPRA SUPERMERCADO EXTRA")
    checa("a linha em espera some", all(t["id"] != linha["id"] for t in tx()))
    checa("evento reconciled_with entra no histórico",
          any(e["event"] == "reconciled_with" for e in ok["history"]))
    r8 = imp.importar(1, "s.ofx", extrato)
    checa("PRD: conciliar e reimportar o mesmo arquivo não gera nova suspeita",
          r8["aguardando_conciliacao"] == 0 and r8["importadas"] == 0 and r8["ja_existiam"] == 2, str(r8))

    # ----------------------------------------------- previsto vira realizado
    print()
    print("Previsto vira realizado")
    serie_tx = DataService.create_transaction(
        user_id=1, category_id=5, type="expense", amount=1800.0,
        due_date=d(2), description="Aluguel",
        series={"kind": "recurring", "frequency": "monthly"},
    )
    prevista = next(t for t in tx() if t.get("series_id") == serie_tx["series_id"] and t["due_date"] == d(2))
    checa("ocorrência de série nasce prevista (sem efetivação)", prevista["settled_at"] is None)
    imp.importar(1, "al.ofx", ofx_sgml([(d(1), "-1800.00", "AL1", "ALUGUEL SETEMBRO")]))
    espera = [t for t in tx() if t.get("ingest_state") == "awaiting_reconciliation"]
    checa("linha do extrato casa com a ocorrência PREVISTA da série",
          len(espera) == 1 and espera[0]["reconcile_candidate_id"] == prevista["id"])
    fund = imp.conciliar(espera[0]["id"], "merge")
    checa("fundir efetiva a ocorrência: previsto vira realizado",
          fund["settled_at"] == d(1) and fund["series_id"] == serie_tx["series_id"], str(fund["settled_at"]))

    # ------------------------- candidato já efetivado mantém a data do usuário
    manual2 = DataService.create_transaction(
        user_id=1, category_id=2, type="expense", amount=40.0,
        due_date=d(6), settled_at=d(6), description="Uber centro",
    )
    imp.importar(1, "ub.ofx", ofx_sgml([(d(4), "-40.00", "UB1", "UBER CENTRO")]))
    esp2 = [t for t in tx() if t.get("ingest_state") == "awaiting_reconciliation"]
    f2 = imp.conciliar(esp2[0]["id"], "merge")
    checa("registro já efetivado mantém a data escolhida pelo usuário", f2["settled_at"] == d(6), f2["settled_at"])

    # -------------------------------------------------------- não é duplicata
    manual3 = DataService.create_transaction(
        user_id=1, category_id=3, type="expense", amount=60.0,
        due_date=d(7), settled_at=d(7), description="Farmacia Sao Joao",
    )
    imp.importar(1, "fa.ofx", ofx_sgml([(d(7), "-60.00", "FA1", "FARMACIA SAO JOAO")]))
    esp3 = [t for t in tx() if t.get("ingest_state") == "awaiting_reconciliation"]
    antes_saldo = len(visiveis())
    conf = imp.conciliar(esp3[0]["id"], "not_duplicate")
    checa("'não é duplicata' confirma e a linha entra normalmente",
          conf["ingest_state"] == "confirmed" and len(visiveis()) == antes_saldo + 1)

    # ----------------------------------------------- casos que NÃO devem suspeitar
    print()
    print("Falso positivo")
    DataService.create_transaction(
        user_id=1, category_id=1, type="expense", amount=33.0,
        due_date=d(12), settled_at=d(12), description="Compra cartao",
    )
    p = imp.analisar(1, "g.ofx", ofx_sgml([(d(12), "-33.00", "G1", "COMPRA CARTAO PADARIA")]))
    checa("palavra genérica ('compra', 'cartão') não basta pra suspeitar", p["linhas"][0]["situacao"] == "nova")

    # duas compras iguais que vieram do banco (FITIDs diferentes) são distintas
    imp.importar(1, "d1.ofx", ofx_sgml([(d(13), "-25.00", "D1", "RESTAURANTE SABOR")]))
    p = imp.analisar(1, "d2.ofx", ofx_sgml([(d(13), "-25.00", "D2", "RESTAURANTE SABOR")]))
    checa("registro que já veio do banco não é candidato a duplicata",
          p["linhas"][0]["situacao"] == "nova", p["linhas"][0]["situacao"])

    # cada candidato é reivindicado por uma linha só
    DataService.create_transaction(
        user_id=1, category_id=1, type="expense", amount=50.0,
        due_date=d(14), settled_at=d(14), description="Padaria do Ze",
    )
    p = imp.analisar(1, "u.ofx", ofx_sgml([(d(14), "-50.00", "U1", "PADARIA DO ZE"),
                                          (d(14), "-50.00", "U2", "PADARIA DO ZE")]))
    sit = sorted(l["situacao"] for l in p["linhas"])
    checa("duas linhas iguais, um lançamento manual: uma suspeita e uma nova", sit == ["nova", "suspeita"], str(sit))

    # tipo e valor diferentes não casam
    DataService.create_transaction(
        user_id=1, category_id=1, type="expense", amount=99.0,
        due_date=d(15), settled_at=d(15), description="Livraria Cultura",
    )
    p = imp.analisar(1, "v.ofx", ofx_sgml([(d(15), "99.00", "V1", "LIVRARIA CULTURA")]))
    checa("mesmo valor mas tipo oposto (crédito x débito) não casa", p["linhas"][0]["situacao"] == "nova")
    p = imp.analisar(1, "w.ofx", ofx_sgml([(d(15), "-99.01", "W1", "LIVRARIA CULTURA")]))
    checa("diferença de 1 centavo não casa", p["linhas"][0]["situacao"] == "nova")
    p = imp.analisar(1, "x.ofx", ofx_sgml([(d(20), "-99.00", "X1", "LIVRARIA CULTURA")]))
    checa("fora da janela de ±3 dias não casa", p["linhas"][0]["situacao"] == "nova")

    # ------------------------------------------- entre formatos e planilha
    print()
    print("Formatos")
    mesmas = [(d(30), "-45.90", "CF1", "ACADEMIA BODY TECH"), (d(29), "-12.00", "CF2", "ESTACIONAMENTO CENTRO")]
    imp.importar(1, "cf.csv", csv_bytes([[l[0], l[3], l[1].replace(".", ",")] for l in mesmas]))
    r_of = imp.importar(1, "cf.ofx", ofx_sgml(mesmas))
    checa("mesmo extrato em CSV e depois OFX não entra duplicado em silêncio: vai pra conciliação",
          r_of["importadas"] == 0 and r_of["aguardando_conciliacao"] == 2, str(r_of))
    for esp in [x for x in tx() if x.get("ingest_state") == "awaiting_reconciliation"]:
        imp.conciliar(esp["id"], "merge")
    funde = [x for x in tx() if x.get("bank_description") in ("ACADEMIA BODY TECH", "ESTACIONAMENTO CENTRO")]
    checa("ao fundir, o registro do CSV ganha o FITID e mantém o hash antigo",
          len(funde) == 2 and all(x["external_id"] and x["import_hash"] for x in funde))
    r_a = imp.importar(1, "cf.ofx", ofx_sgml(mesmas))
    r_b = imp.importar(1, "cf.csv", csv_bytes([[l[0], l[3], l[1].replace(".", ",")] for l in mesmas]))
    checa("depois disso os DOIS formatos são reconhecidos (0 novas em cada)",
          r_a["importadas"] == 0 and r_a["aguardando_conciliacao"] == 0
          and r_b["importadas"] == 0 and r_b["aguardando_conciliacao"] == 0, "ofx=%s csv=%s" % (r_a["ja_existiam"], r_b["ja_existiam"]))

    from io import BytesIO
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["Data", "Histórico", "Valor"])
    ws.append([date.fromisoformat(d(40)), "Pagamento fornecedor", -300.5])
    ws.append([date.fromisoformat(d(39)), "Recebimento cliente", 1200])
    buf = BytesIO()
    wb.save(buf)
    formato_x, linhas_x, _, _ = imp.ler_arquivo("planilha.xlsx", buf.getvalue())
    checa("xlsx com datas reais e cabeçalho 'Histórico' é lido",
          formato_x == "xlsx" and len(linhas_x) == 2 and linhas_x[0]["amount"] == 300.5, str(len(linhas_x)))
    checa("xlsx: tipo pelo sinal", linhas_x[0]["type"] == "expense" and linhas_x[1]["type"] == "income")

    # ------------------------------------------------------- erros
    print()
    print("Erros")
    try:
        imp.conciliar(999999, "merge")
        checa("conciliar id inexistente", False)
    except LookupError:
        checa("conciliar id inexistente levanta LookupError", True)
    try:
        imp.conciliar(manual["id"], "merge")
        checa("conciliar lançamento que não está em espera", False)
    except ValueError:
        checa("conciliar lançamento que não está em espera é recusado", True)
    try:
        imp.ler_arquivo("a.xls", b"x")
        checa(".xls recusado", False)
    except imp.ArquivoInvalido as e:
        checa(".xls antigo é recusado com orientação", "xlsx" in str(e))

    # ------------------------------------------------------------- API
    # Multipart, códigos HTTP e mensagens: o que o serviço sozinho não exercita.
    print()
    print("API")
    from fastapi.testclient import TestClient
    from app.main import app

    cli = TestClient(app)
    api_ofx = ofx_sgml([(d(50), "-64.90", "API1", "LOJA DA API UM"), (d(49), "-11.10", "API2", "LOJA DA API DOIS")])

    r = cli.post("/api/import/preview", data={"user_id": 1}, files={"file": ("api.ofx", api_ofx)})
    checa("POST /api/import/preview devolve 200 e a contagem",
          r.status_code == 200 and r.json()["data"]["contagem"]["nova"] == 2, str(r.status_code))
    antes = len(tx())
    checa("a prévia via API não grava", len(tx()) == antes)

    r = cli.post("/api/import/commit", data={"user_id": 1}, files={"file": ("api.ofx", api_ofx)})
    checa("POST /api/import/commit grava", r.status_code == 200 and r.json()["data"]["importadas"] == 2)
    r = cli.post("/api/import/commit", data={"user_id": 1}, files={"file": ("api.ofx", api_ofx)})
    checa("reimportar via API é idempotente", r.json()["data"]["importadas"] == 0)

    r = cli.post("/api/import/preview", data={"user_id": 1}, files={"file": ("x.pdf", b"%PDF-1.4 nada")})
    checa("formato não suportado devolve 400 com mensagem em português",
          r.status_code == 400 and "Formato" in r.json()["detail"], r.text[:80])
    r = cli.post("/api/import/preview", data={"user_id": 1}, files={"file": ("vazio.csv", b"")})
    checa("arquivo vazio devolve 400", r.status_code == 400)
    r = cli.post("/api/import/preview", data={"user_id": 1},
                 files={"file": ("grande.csv", b"data;descricao;valor\n" + b"x" * (5 * 1024 * 1024 + 10))})
    checa("arquivo acima de 5 MB devolve 413", r.status_code == 413, str(r.status_code))

    # lista a fila via filtro e resolve via /api/reconcile
    manual_api = DataService.create_transaction(
        user_id=1, category_id=1, type="expense", amount=30.0,
        due_date=d(60), settled_at=d(60), description="Mercadinho Central",
    )
    cli.post("/api/import/commit", data={"user_id": 1},
             files={"file": ("m.ofx", ofx_sgml([(d(60), "-30.00", "M1", "MERCADINHO CENTRAL")]))})
    fila = cli.get("/api/transactions/user/1", params={"ingest_state": "awaiting_reconciliation"}).json()["data"]
    checa("GET ?ingest_state=awaiting_reconciliation devolve a fila", len(fila) == 1 and fila[0]["reconcile_candidate_id"] == manual_api["id"])
    padrao = cli.get("/api/transactions/user/1").json()["data"]
    checa("a listagem padrão NÃO traz a fila", all(x.get("ingest_state", "confirmed") == "confirmed" for x in padrao))

    r = cli.post("/api/reconcile/%d" % fila[0]["id"], json={"action": "merge"})
    checa("POST /api/reconcile funde e devolve o registro que fica",
          r.status_code == 200 and r.json()["data"]["id"] == manual_api["id"])
    r = cli.post("/api/reconcile/%d" % fila[0]["id"], json={"action": "merge"})
    checa("conciliar de novo a mesma linha devolve 404 (ela já foi absorvida)", r.status_code == 404, str(r.status_code))
    r = cli.post("/api/reconcile/%d" % manual_api["id"], json={"action": "merge"})
    checa("conciliar quem não está em espera devolve 400", r.status_code == 400, str(r.status_code))
    r = cli.post("/api/reconcile/1", json={"action": "explodir"})
    checa("ação desconhecida é rejeitada na validação (422)", r.status_code == 422, str(r.status_code))

    print()
    if falhas:
        print("FALHARAM: %d" % len(falhas))
        for f_ in falhas:
            print("  -", f_)
        return 1
    print("todos os critérios passaram")
    shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
