# -*- coding: utf-8 -*-
"""
Critérios de aceite de Relatórios: período, comparação e cards (issue #14,
spec #7). Roda sobre o MemoriaStore: nenhum arquivo é tocado.

    cada atalho de período devolve o intervalo certo; período aberto compara
    com o mesmo trecho do anterior, o fechado com o anterior inteiro e o
    personalizado com a janela anterior de mesma duração; anterior zero ou
    vazio fica sem percentual e com a diferença em reais; transferência
    interna e ingestão pendente não entram em nenhum número.

Os valores esperados são datas e números literais, escritos à mão.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import relatorios  # noqa: E402
from app.services.store import MemoriaStore, usar_store  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def intervalos(periodo, hoje, de=None, ate=None):
    """Só o que importa do período: (de, ate), anterior, anterior inteiro, aberto."""
    p = relatorios.resolver_periodo(periodo, hoje, de, ate)
    return (
        (p["de"], p["ate"]),
        (p["anterior"]["de"], p["anterior"]["ate"]),
        (p["anterior_inteiro"]["de"], p["anterior_inteiro"]["ate"]),
        p["aberto"],
    )


def atalhos():
    print("atalhos de período (hoje = quarta, 07/10/2026)")
    H = "2026-10-07"
    casos = [
        # atalho, período, anterior (o mesmo trecho), anterior inteiro, aberto
        ("hoje", ("2026-10-07", "2026-10-07"), ("2026-10-06", "2026-10-06"), ("2026-10-06", "2026-10-06"), True),
        # A semana começa na segunda (05/10); a anterior vai da segunda 28/09
        # até a quarta 30/09 (mesmo trecho) e a inteira até o domingo 04/10.
        ("semana", ("2026-10-05", "2026-10-07"), ("2026-09-28", "2026-09-30"), ("2026-09-28", "2026-10-04"), True),
        ("mes", ("2026-10-01", "2026-10-07"), ("2026-09-01", "2026-09-07"), ("2026-09-01", "2026-09-30"), True),
        ("mes_anterior", ("2026-09-01", "2026-09-30"), ("2026-08-01", "2026-08-31"), ("2026-08-01", "2026-08-31"), False),
        ("ultimos_3_meses", ("2026-08-01", "2026-10-07"), ("2026-05-01", "2026-07-07"), ("2026-05-01", "2026-07-31"), True),
        ("ultimos_6_meses", ("2026-05-01", "2026-10-07"), ("2025-11-01", "2026-04-07"), ("2025-11-01", "2026-04-30"), True),
        ("ultimos_12_meses", ("2025-11-01", "2026-10-07"), ("2024-11-01", "2025-10-07"), ("2024-11-01", "2025-10-31"), True),
        ("ano", ("2026-01-01", "2026-10-07"), ("2025-01-01", "2025-10-07"), ("2025-01-01", "2025-12-31"), True),
    ]
    for atalho, per, ant, inteiro, aberto in casos:
        obtido = intervalos(atalho, H)
        checa(f"{atalho}: período {per[0]} a {per[1]}", obtido[0] == per, str(obtido[0]))
        checa(f"{atalho}: anterior {ant[0]} a {ant[1]}", obtido[1] == ant, str(obtido[1]))
        checa(f"{atalho}: anterior inteiro {inteiro[0]} a {inteiro[1]}", obtido[2] == inteiro, str(obtido[2]))
        checa(f"{atalho}: {'aberto' if aberto else 'fechado'}", obtido[3] is aberto)

    # Segunda-feira: a semana é só hoje; domingo: a semana tem sete dias.
    checa("semana numa segunda (05/10) começa no próprio dia", intervalos("semana", "2026-10-05")[0] == ("2026-10-05", "2026-10-05"))
    checa("semana num domingo (11/10) começa na segunda 05/10", intervalos("semana", "2026-10-11")[0] == ("2026-10-05", "2026-10-11"))
    # Virada de ano e mês curto.
    checa("mês anterior em janeiro é dezembro do ano passado", intervalos("mes_anterior", "2026-01-15")[0] == ("2025-12-01", "2025-12-31"))
    checa("mês anterior em janeiro compara com novembro", intervalos("mes_anterior", "2026-01-15")[1] == ("2025-11-01", "2025-11-30"))
    checa("este mês em 31/03 compara até 28/02 (fevereiro não tem 31)", intervalos("mes", "2026-03-31")[1] == ("2026-02-01", "2026-02-28"))
    checa("este ano em 29/02/2028 compara até 28/02/2027", intervalos("ano", "2028-02-29")[1] == ("2027-01-01", "2027-02-28"))

    print("período personalizado")
    ok = intervalos("personalizado", H, "2026-09-10", "2026-09-19")
    checa("personalizado mantém de/até", ok[0] == ("2026-09-10", "2026-09-19"), str(ok[0]))
    checa("personalizado compara com a janela anterior de mesma duração (10 dias)", ok[1] == ("2026-08-31", "2026-09-09"), str(ok[1]))
    checa("personalizado: o anterior inteiro é a mesma janela", ok[2] == ok[1])
    checa("personalizado é fechado", ok[3] is False)
    um = intervalos("personalizado", H, "2026-10-03", "2026-10-03")
    checa("personalizado de um dia compara com o dia anterior", um[1] == ("2026-10-02", "2026-10-02"), str(um[1]))

    print("pedidos inválidos")
    for nome, args in [
        ("atalho desconhecido", ("quinzena", H, None, None)),
        ("personalizado sem datas", ("personalizado", H, None, None)),
        ("personalizado com data inexistente", ("personalizado", H, "2026-02-30", "2026-03-05")),
        ("personalizado invertido", ("personalizado", H, "2026-09-10", "2026-09-01")),
        ("hoje malformado", ("mes", "07/10/2026", None, None)),
    ]:
        try:
            relatorios.resolver_periodo(*args)
            levantou = False
        except ValueError:
            levantou = True
        checa(f"{nome} levanta ValueError", levantou)


_proximo = [0]


def lanc(user_id=1, tipo="expense", valor=0.0, data="2026-10-01", **campos):
    """Um lançamento efetivado na `data` (a data do lançamento)."""
    _proximo[0] += 1
    t = {
        "id": _proximo[0], "user_id": user_id, "type": tipo, "amount": valor,
        "description": "x", "category_id": None, "due_date": data, "settled_at": data,
        "account_id": None, "is_internal_transfer": False, "needs_transfer_review": False,
        "series_id": None, "series_index": None, "ingest_state": "confirmed",
        "source": "manual", "external_id": None, "import_hash": None, "history": [],
        "created_at": "2026-09-30T12:00:00Z",
    }
    t.update(campos)
    return t


def cartao(r, nome):
    c = r[nome]
    return (c["valor"], c["anterior"], c["anterior_inteiro"], c["diferenca"], c["percentual"])


def cards():
    print("resumo: Receita, Despesa e Resultado do período (hoje = 03/10/2026)")
    H = "2026-10-03"
    store = MemoriaStore()
    store.save("transactions", [
        # Outubro, até o dia 3.
        lanc(tipo="income", valor=1000, data="2026-10-01"),
        lanc(valor=200, data="2026-10-02"),
        lanc(valor=50, data="2026-10-03"),
        # Depois de hoje: fora do trecho de "este mês".
        lanc(valor=999, data="2026-10-04"),
        # Setembro: o trecho 1 a 3 e o resto do mês.
        lanc(valor=70, data="2026-09-01"),
        lanc(tipo="income", valor=800, data="2026-09-02"),
        lanc(valor=100, data="2026-09-03"),
        lanc(valor=400, data="2026-09-20"),
        lanc(tipo="income", valor=500, data="2026-09-25"),
        # Não entram em número nenhum:
        lanc(valor=5000, data="2026-10-02", is_internal_transfer=True),
        lanc(tipo="income", valor=6000, data="2026-09-02", is_internal_transfer=True),
        lanc(valor=7000, data="2026-10-02", ingest_state="pending_reconciliation"),
        lanc(valor=3000, data="2026-10-02", settled_at=None),  # previsto: não se moveu
        lanc(user_id=2, valor=9999, data="2026-10-02"),
    ])
    anterior_store = usar_store(store)
    try:
        r = relatorios.resumo(1, "mes", H)
        # Este mês (1 a 3/10): receita 1000, despesa 200+50 = 250. O mesmo trecho
        # de setembro (1 a 3/09): receita 800, despesa 70+100 = 170. O setembro
        # inteiro: receita 800+500, despesa 70+100+400.
        checa("este mês: receita 1000 (anterior 800, inteiro 1300, +200, +25,0%)", cartao(r, "receita") == (1000, 800, 1300, 200, 25.0), str(cartao(r, "receita")))
        checa("este mês: despesa 250 (anterior 170, inteiro 570, +80, +47,1%)", cartao(r, "despesa") == (250, 170, 570, 80, 47.1), str(cartao(r, "despesa")))
        checa("este mês: resultado 750 (anterior 630, inteiro 730, +120, +19,0%)", cartao(r, "resultado") == (750, 630, 730, 120, 19.0), str(cartao(r, "resultado")))
        checa("devolve os intervalos usados", r["periodo"]["de"] == "2026-10-01" and r["periodo"]["ate"] == "2026-10-03"
              and r["anterior"] == {"de": "2026-09-01", "ate": "2026-09-03"}
              and r["anterior_inteiro"] == {"de": "2026-09-01", "ate": "2026-09-30"}, str(r["periodo"]))

        r = relatorios.resumo(1, "hoje", H)
        checa("hoje: despesa 50 contra 200 de ontem (-150, -75,0%)", cartao(r, "despesa") == (50, 200, 200, -150, -75.0), str(cartao(r, "despesa")))
        checa("hoje: resultado -50 contra -200 (+150, +75,0%: o sinal da variação segue o ganho)", cartao(r, "resultado") == (-50, -200, -200, 150, 75.0), str(cartao(r, "resultado")))
        checa("hoje: receita 0 contra 0 não tem percentual e a diferença é 0", cartao(r, "receita") == (0, 0, 0, 0, None), str(cartao(r, "receita")))

        # Período fechado: compara com o anterior inteiro.
        r = relatorios.resumo(1, "mes_anterior", H)
        checa("mês anterior: receita 1300, despesa 570, resultado 730", (r["receita"]["valor"], r["despesa"]["valor"], r["resultado"]["valor"]) == (1300, 570, 730))
        checa("mês anterior: o anterior (agosto) é vazio, sem percentual e com a diferença em reais",
              cartao(r, "receita") == (1300, 0, 0, 1300, None) and cartao(r, "despesa") == (570, 0, 0, 570, None) and cartao(r, "resultado") == (730, 0, 0, 730, None),
              str([cartao(r, n) for n in ("receita", "despesa", "resultado")]))

        # Personalizado: janela imediatamente anterior de mesma duração (2 dias: 02 e 03/09 contra 31/08 e 01/09).
        r = relatorios.resumo(1, "personalizado", H, "2026-09-02", "2026-09-03")
        checa("personalizado: despesa 100 contra 70 da janela anterior (+30, +42,9%)", cartao(r, "despesa") == (100, 70, 70, 30, 42.9), str(cartao(r, "despesa")))
        checa("personalizado: receita 800 contra 0 não tem percentual (+800)", cartao(r, "receita") == (800, 0, 0, 800, None), str(cartao(r, "receita")))
        checa("personalizado: devolve a janela anterior de mesma duração", r["anterior"] == {"de": "2026-08-31", "ate": "2026-09-01"}, str(r["anterior"]))

        # Usuário sem lançamentos: zeros, nunca erro.
        r = relatorios.resumo(3, "mes", H)
        checa("sem lançamentos: tudo zero e sem percentual", cartao(r, "despesa") == (0, 0, 0, 0, None) and cartao(r, "resultado") == (0, 0, 0, 0, None))

        # Pela API: o mesmo número, sem Saldo.
        cli = TestClient(app)
        resp = cli.get("/api/reports/summary/1", params={"periodo": "mes", "hoje": H})
        corpo = resp.json().get("data", {})
        checa("GET /api/reports/summary/{id} devolve o resumo do período", resp.status_code == 200 and corpo.get("despesa", {}).get("valor") == 250, str(resp.status_code))
        checa("o resumo não traz Saldo", "balance" not in corpo and "saldo" not in corpo)
        resp = cli.get("/api/reports/summary/1", params={"hoje": H})
        checa("sem `periodo` o padrão é este mês", resp.json()["data"]["periodo"]["atalho"] == "mes")
        resp = cli.get("/api/reports/summary/1", params={"periodo": "personalizado", "hoje": H, "de": "2026-09-10", "ate": "2026-09-01"})
        checa("pedido inválido responde 422 com a frase", resp.status_code == 422 and isinstance(resp.json().get("detail"), str), str(resp.status_code))
        resp = cli.get("/api/reports/summary/1", params={"periodo": "mes"})
        checa("sem `hoje` responde 422 (quem sabe o dia é o cliente)", resp.status_code == 422, str(resp.status_code))
    finally:
        usar_store(anterior_store)


def lista(r):
    """As categorias reais como (id, nome, valor, anterior, inteiro, diferença, %)."""
    return [
        (c["category_id"], c["nome"], c["valor"], c["anterior"], c["anterior_inteiro"], c["diferenca"], c["percentual"])
        for c in r["categorias"]
    ]


def categorias():
    print("despesas por categoria (issue #17; hoje = 03/10/2026)")
    H = "2026-10-03"
    store = MemoriaStore()
    store.save("categories", [
        {"id": 1, "name": "Alimentação"}, {"id": 2, "name": "Transporte"}, {"id": 6, "name": "Outros"},
    ])
    store.save("transactions", [
        # Outubro, até o dia 3: Alimentação 150, Transporte 30, sem categoria 7.
        lanc(valor=100, data="2026-10-01", category_id=1),
        lanc(valor=50, data="2026-10-02", category_id=1),
        lanc(valor=30, data="2026-10-02", category_id=2),
        lanc(valor=7, data="2026-10-03"),
        lanc(valor=999, data="2026-10-04", category_id=1),  # depois de hoje
        # Receita (com ou sem categoria): fora do gráfico de despesas e do balde.
        lanc(tipo="income", valor=500, data="2026-10-02"),
        lanc(tipo="income", valor=300, data="2026-10-02", category_id=1),
        # Setembro, trecho 1 a 3: Alimentação 100, Outros 60, sem categoria 40.
        lanc(valor=100, data="2026-09-01", category_id=1),
        lanc(valor=60, data="2026-09-02", category_id=6),
        lanc(valor=40, data="2026-09-03"),
        # Setembro, resto: Alimentação 70, sem categoria 10.
        lanc(valor=70, data="2026-09-20", category_id=1),
        lanc(valor=10, data="2026-09-21"),
        # Não entram em número nenhum:
        lanc(valor=5000, data="2026-10-02", category_id=1, is_internal_transfer=True),
        lanc(valor=5000, data="2026-10-02", is_internal_transfer=True),
        lanc(valor=7000, data="2026-10-02", category_id=2, ingest_state="pending_reconciliation"),
        lanc(valor=7000, data="2026-10-02", ingest_state="pending_reconciliation"),
        lanc(valor=3000, data="2026-10-02", category_id=2, settled_at=None),  # previsto
        lanc(user_id=2, valor=9999, data="2026-10-02", category_id=1),
        # Usuário 4: tudo categorizado, sem balde.
        lanc(user_id=4, valor=80, data="2026-10-02", category_id=1),
        # Usuário 5: só gasto sem categoria, nenhum no anterior.
        lanc(user_id=5, valor=25, data="2026-10-02"),
        # Usuário 6: balde de 7 num total de 50 = 14% EXATOS (em ponto flutuante,
        # 7/50*100 dá 14,000000000000002 e o arredondamento para cima errava para 15).
        lanc(user_id=6, valor=7, data="2026-10-02"),
        lanc(user_id=6, valor=43, data="2026-10-02", category_id=1),
    ])
    anterior_store = usar_store(store)
    try:
        r = relatorios.categorias(1, "mes", H)
        # Alimentação 150 contra 100 (+50, +50,0%), inteiro 170; Transporte 30
        # contra 0 (sem percentual). Outros só existe no anterior: não aparece.
        checa("este mês: categorias reais por valor, com anterior e variação",
              lista(r) == [(1, "Alimentação", 150, 100, 170, 50, 50.0), (2, "Transporte", 30, 0, 0, 30, None)], str(lista(r)))
        sc = r["sem_categoria"]
        checa("este mês: balde Sem categoria 7 contra 40 (-33, -82,5%), inteiro 50, fora da lista das reais",
              sc is not None and (sc["valor"], sc["anterior"], sc["anterior_inteiro"], sc["diferenca"], sc["percentual"]) == (7, 40, 50, -33, -82.5), str(sc))
        checa("total do gráfico é 187 (150 + 30 + 7): receita, transferência, ingestão pendente e previsto ficam de fora", r["total"] == 187, str(r["total"]))
        checa("percentual do balde: 7/187 = 3,74% arredondado para cima = 4", r["percentual_sem_categoria"] == 4, str(r["percentual_sem_categoria"]))
        checa("devolve o intervalo e a janela anterior (para o link e o rótulo)",
              r["periodo"]["de"] == "2026-10-01" and r["periodo"]["ate"] == "2026-10-03"
              and r["anterior"] == {"de": "2026-09-01", "ate": "2026-09-03"}
              and r["anterior_inteiro"] == {"de": "2026-09-01", "ate": "2026-09-30"}, str(r["periodo"]))

        r = relatorios.categorias(1, "hoje", H)
        checa("hoje: só o balde (7), contra 0 de ontem, sem percentual de variação",
              lista(r) == [] and r["sem_categoria"]["valor"] == 7 and r["sem_categoria"]["percentual"] is None and r["total"] == 7, str(r))
        checa("hoje: o balde é 100% do gráfico", r["percentual_sem_categoria"] == 100, str(r["percentual_sem_categoria"]))

        r = relatorios.categorias(1, "mes_anterior", H)
        checa("mês anterior: Alimentação 170, Outros 60 (agosto vazio: sem percentual)",
              lista(r) == [(1, "Alimentação", 170, 0, 0, 170, None), (6, "Outros", 60, 0, 0, 60, None)], str(lista(r)))
        checa("mês anterior: balde 50 de 280 = 17,86% -> 18", r["sem_categoria"]["valor"] == 50 and r["total"] == 280 and r["percentual_sem_categoria"] == 18, str(r["total"]))

        r = relatorios.categorias(1, "personalizado", H, "2026-09-02", "2026-09-03")
        checa("personalizado: Outros 60 contra 0, sem Alimentação; balde 40 contra 0",
              lista(r) == [(6, "Outros", 60, 0, 0, 60, None)] and r["sem_categoria"]["valor"] == 40, str(lista(r)))

        r = relatorios.categorias(4, "mes", H)
        checa("sem lançamento sem categoria o balde não existe", r["sem_categoria"] is None and r["percentual_sem_categoria"] == 0 and r["total"] == 80, str(r["sem_categoria"]))

        r = relatorios.categorias(5, "mes", H)
        checa("só balde: lista de reais vazia e o balde é 100%", lista(r) == [] and r["sem_categoria"]["valor"] == 25 and r["percentual_sem_categoria"] == 100)

        r = relatorios.categorias(6, "mes", H)
        checa("percentual exato não sobe: 7 de 50 é 14%, não 15%", r["total"] == 50 and r["percentual_sem_categoria"] == 14, str(r["percentual_sem_categoria"]))

        r = relatorios.categorias(3, "mes", H)
        checa("período vazio: sem categorias, sem balde, total 0 e sem erro",
              lista(r) == [] and r["sem_categoria"] is None and r["total"] == 0 and r["percentual_sem_categoria"] == 0)

        cli = TestClient(app)
        resp = cli.get("/api/reports/categories/1", params={"periodo": "mes", "hoje": H})
        corpo = resp.json().get("data", {})
        checa("GET /api/reports/categories/{id} devolve as categorias do período",
              resp.status_code == 200 and corpo.get("total") == 187 and len(corpo.get("categorias", [])) == 2, str(resp.status_code))
        resp = cli.get("/api/reports/categories/1", params={"periodo": "personalizado", "hoje": H, "de": "2026-09-10", "ate": "2026-09-01"})
        checa("pedido inválido responde 422 com a frase", resp.status_code == 422 and isinstance(resp.json().get("detail"), str))
    finally:
        usar_store(anterior_store)


def main():
    atalhos()
    print()
    cards()
    print()
    categorias()
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
