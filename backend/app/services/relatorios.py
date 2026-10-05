"""
Relatórios (issue #14, spec #7): período, comparação e cards de resultado.

A matemática de períodos vive só aqui; a tela manda o atalho escolhido e a
data de hoje (do relógio local do cliente) e recebe os intervalos prontos.
Datas de calendário são `AAAA-MM-DD`, lidas como datas puras (sem fuso).

Período: de..ate, inclusivos. Os atalhos "abertos" (hoje, semana, mês, últimos
N meses, ano) vão do início até hoje e se comparam com o MESMO TRECHO do
anterior; "mês anterior" e o personalizado são fechados.
"""

import calendar
from datetime import date, timedelta
from typing import Any, Dict, Optional, Tuple

from app.services.data_service import DataService

ATALHOS = (
    "hoje",
    "semana",
    "mes",
    "mes_anterior",
    "ultimos_3_meses",
    "ultimos_6_meses",
    "ultimos_12_meses",
    "ano",
    "personalizado",
)
PADRAO = "mes"


def _data(texto: Optional[str], campo: str) -> date:
    try:
        return date.fromisoformat(texto or "")
    except ValueError:
        raise ValueError(f"{campo} inválida: use AAAA-MM-DD") from None


def _soma_meses(d: date, meses: int) -> date:
    """`d` deslocado em `meses` meses; o dia encolhe se o mês de destino for mais curto."""
    indice = d.year * 12 + (d.month - 1) + meses
    ano, mes = divmod(indice, 12)
    mes += 1
    return date(ano, mes, min(d.day, calendar.monthrange(ano, mes)[1]))


def _fim_do_mes(d: date) -> date:
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def _par(de: date, ate: date) -> Dict[str, str]:
    return {"de": de.isoformat(), "ate": ate.isoformat()}


def resolver_periodo(
    periodo: str, hoje: str, de: Optional[str] = None, ate: Optional[str] = None
) -> Dict[str, Any]:
    """
    Intervalo do atalho e as duas janelas de comparação:

    - `anterior`: o mesmo trecho do período anterior (para o aberto) ou o
      anterior inteiro (para o fechado);
    - `anterior_inteiro`: o período anterior por inteiro, para mostrar ao lado.

    Levanta `ValueError` com a frase pronta para o usuário se o pedido for inválido.
    """
    h = _data(hoje, "hoje")

    if periodo == "personalizado":
        inicio, fim = _data(de, "de"), _data(ate, "ate")
        if inicio > fim:
            raise ValueError("A data inicial é depois da final.")
        dias = (fim - inicio).days + 1
        janela = {"de": (inicio - timedelta(days=dias)).isoformat(), "ate": (inicio - timedelta(days=1)).isoformat()}
        return {"atalho": periodo, "de": inicio.isoformat(), "ate": fim.isoformat(), "aberto": False,
                "anterior": janela, "anterior_inteiro": dict(janela)}

    if periodo == "mes_anterior":
        inicio = _soma_meses(h.replace(day=1), -1)
        fim = _fim_do_mes(inicio)
        antes = _soma_meses(inicio, -1)
        janela = _par(antes, _fim_do_mes(antes))
        return {"atalho": periodo, "de": inicio.isoformat(), "ate": fim.isoformat(), "aberto": False,
                "anterior": janela, "anterior_inteiro": dict(janela)}

    # Atalhos abertos: começam num ponto, vão até hoje, e o anterior é o
    # mesmo trecho deslocado para trás (em dias ou em meses).
    meses = {"mes": 1, "ultimos_3_meses": 3, "ultimos_6_meses": 6, "ultimos_12_meses": 12, "ano": 12}
    if periodo == "hoje":
        inicio, desloca = h, lambda d: d - timedelta(days=1)
        fim_anterior = inicio - timedelta(days=1)
    elif periodo == "semana":
        inicio, desloca = h - timedelta(days=h.weekday()), lambda d: d - timedelta(days=7)
        fim_anterior = inicio - timedelta(days=1)
    elif periodo in meses:
        n = meses[periodo]
        if periodo == "ano":
            inicio = date(h.year, 1, 1)
        else:
            inicio = _soma_meses(h.replace(day=1), -(n - 1))
        desloca = lambda d: _soma_meses(d, -n)  # noqa: E731
        fim_anterior = inicio - timedelta(days=1)
    else:
        raise ValueError(f"Período desconhecido: {periodo}")

    return {
        "atalho": periodo, "de": inicio.isoformat(), "ate": h.isoformat(), "aberto": True,
        "anterior": _par(desloca(inicio), desloca(h)),
        "anterior_inteiro": _par(desloca(inicio), fim_anterior),
    }


def _somas(user_id: int, de: str, ate: str) -> Tuple[float, float]:
    """(receita, despesa) do que foi EFETIVADO entre `de` e `ate`, inclusivos.

    A data é a do lançamento (`settled_at`, a que a tabela de Transações mostra).
    `get_settled_by_user` já deixa de fora o previsto e a ingestão pendente;
    a transferência interna sai aqui. Estorno e pagamento de fatura ainda não
    existem (Fatia 5).
    """
    receita = despesa = 0.0
    for t in DataService.get_settled_by_user(user_id):
        if t.get("is_internal_transfer"):
            continue
        dia = t["settled_at"][:10]
        if not de <= dia <= ate:
            continue
        if t["type"] == "income":
            receita += t["amount"]
        elif t["type"] == "expense":
            despesa += t["amount"]
    return round(receita, 2), round(despesa, 2)


def _cartao(valor: float, anterior: float, anterior_inteiro: float) -> Dict[str, Any]:
    """Um card: o valor, os dois anteriores e a variação contra o `anterior`.

    Anterior zero não tem percentual (`None`: a tela mostra "—"), mas a
    diferença em reais continua. O percentual divide pelo módulo do anterior,
    para que o sinal da variação diga sempre se o número subiu ou desceu.
    """
    diferenca = round(valor - anterior, 2)
    percentual = None if anterior == 0 else round(diferenca / abs(anterior) * 100, 1)
    return {
        "valor": valor,
        "anterior": anterior,
        "anterior_inteiro": anterior_inteiro,
        "diferenca": diferenca,
        "percentual": percentual,
    }


def resumo(
    user_id: int, periodo: str, hoje: str, de: Optional[str] = None, ate: Optional[str] = None
) -> Dict[str, Any]:
    """Receita, Despesa e Resultado do período, cada um contra o anterior."""
    p = resolver_periodo(periodo, hoje, de, ate)
    atual = _somas(user_id, p["de"], p["ate"])
    ant = _somas(user_id, p["anterior"]["de"], p["anterior"]["ate"])
    inteiro = _somas(user_id, p["anterior_inteiro"]["de"], p["anterior_inteiro"]["ate"])

    def resultado(par: Tuple[float, float]) -> float:
        return round(par[0] - par[1], 2)

    return {
        "periodo": {"atalho": p["atalho"], "de": p["de"], "ate": p["ate"], "aberto": p["aberto"]},
        "anterior": p["anterior"],
        "anterior_inteiro": p["anterior_inteiro"],
        "receita": _cartao(atual[0], ant[0], inteiro[0]),
        "despesa": _cartao(atual[1], ant[1], inteiro[1]),
        "resultado": _cartao(resultado(atual), resultado(ant), resultado(inteiro)),
    }


def _despesas_por_categoria(user_id: int, de: str, ate: str) -> Dict[Optional[int], float]:
    """Despesa efetivada entre `de` e `ate` por `category_id` (`None` = sem categoria).

    Mesmo recorte de `_somas`: efetivado, pela data do lançamento, sem
    transferência interna nem ingestão pendente. Só despesa: a receita sem
    categoria não entra no balde (spec, Fatia 4, item 2).
    """
    por_categoria: Dict[Optional[int], float] = {}
    for t in DataService.get_settled_by_user(user_id):
        if t.get("is_internal_transfer") or t["type"] != "expense":
            continue
        if not de <= t["settled_at"][:10] <= ate:
            continue
        chave = t.get("category_id")
        por_categoria[chave] = por_categoria.get(chave, 0.0) + t["amount"]
    return por_categoria


def _percentual_para_cima(parte: float, total: float) -> int:
    """`parte` sobre `total`, em %, arredondado PARA CIMA, sem erro de ponto flutuante.

    Em float, 7/50*100 dá 14,000000000000002 e o `ceil` subiria para 15. Contando
    em centavos inteiros, a divisão é exata: -(-a // b) é o teto da divisão inteira.
    """
    centavos_parte, centavos_total = round(parte * 100), round(total * 100)
    return -(-centavos_parte * 100 // centavos_total)


def categorias(
    user_id: int, periodo: str, hoje: str, de: Optional[str] = None, ate: Optional[str] = None
) -> Dict[str, Any]:
    """Despesas por categoria do período, cada uma contra o anterior (issue #17).

    - `categorias`: só as reais com despesa no período, da maior para a menor,
      cada uma com o cartão de valor/anterior/variação (`_cartao`) e o
      `category_id` para a tela montar o link de Transações. Categoria que só
      tem despesa no anterior não aparece: o gráfico é do período.
    - `sem_categoria`: o balde virtual, FORA da lista (a tela o põe à frente),
      ou `None` se não há despesa sem categoria no período.
    - `total`: categorias reais + balde, a base do gráfico.
    - `percentual_sem_categoria`: inteiro, sobre o `total`, arredondado PARA
      CIMA (0,4% não pode aparecer como 0%); 0 se não há balde.
    """
    p = resolver_periodo(periodo, hoje, de, ate)
    atual = _despesas_por_categoria(user_id, p["de"], p["ate"])
    ant = _despesas_por_categoria(user_id, p["anterior"]["de"], p["anterior"]["ate"])
    inteiro = _despesas_por_categoria(user_id, p["anterior_inteiro"]["de"], p["anterior_inteiro"]["ate"])

    def cartao_de(chave: Optional[int]) -> Dict[str, Any]:
        return _cartao(
            round(atual.get(chave, 0.0), 2), round(ant.get(chave, 0.0), 2), round(inteiro.get(chave, 0.0), 2)
        )

    reais = []
    for chave in atual:
        if chave is None:
            continue
        categoria = DataService.get_category_by_id(chave)
        reais.append({"category_id": chave, "nome": categoria["name"] if categoria else "Outro", **cartao_de(chave)})
    reais.sort(key=lambda c: c["valor"], reverse=True)

    sem_categoria = cartao_de(None) if atual.get(None, 0.0) > 0 else None
    total = round(sum(c["valor"] for c in reais) + (sem_categoria["valor"] if sem_categoria else 0.0), 2)
    percentual = _percentual_para_cima(sem_categoria["valor"], total) if sem_categoria and total > 0 else 0

    return {
        "periodo": {"atalho": p["atalho"], "de": p["de"], "ate": p["ate"], "aberto": p["aberto"]},
        "anterior": p["anterior"],
        "anterior_inteiro": p["anterior_inteiro"],
        "categorias": reais,
        "sem_categoria": sem_categoria,
        "total": total,
        "percentual_sem_categoria": percentual,
    }
