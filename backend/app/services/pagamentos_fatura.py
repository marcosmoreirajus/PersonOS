"""
Pagamento da fatura pela conta corrente (issue #29, Fatia 5).

O pagamento é uma TRANSFERÊNCIA, não despesa: a despesa foi a compra. Aqui ele
é a própria saída da conta, marcada `is_internal_transfer` e com
`invoice_payment = {card_id, cycle}`; a fatura abate o restante (faturas.py) e
o saldo da conta já considera a saída (saldos.py conta as pontas de
transferência). O valor é sempre o da linha real, nunca o total da fatura.

Sugestão, não julgamento: uma saída da conta é *suspeita de pagamento* quando
existe fatura fechada com restante e (o valor iguala o total ou o restante dela
OU a descrição tem um marcador de fatura). A suspeita não é gravada como
verdade: a linha espera em `awaiting_reconciliation` com `payment_suspect`,
fora de toda soma, e o usuário confirma (escolhendo a fatura) ou recusa
(volta como despesa comum). Errar perguntando custa menos que errar calado.

"Fechada" é medido na data da própria linha: um pagamento paga o que já
tinha fechado quando aconteceu. Isso dispensa um "hoje" do cliente na
importação e deixa o resultado determinístico.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services import cartoes, faturas
from app.services.data_service import DataService, em_transacao

# Lista fechada, como as palavras genéricas da importação: texto normalizado
# (sem acento, minúsculo) que a descrição de um pagamento de fatura costuma ter.
MARCADORES_FATURA = ("fatura", "fat cartao", "pgto cartao", "pagto cartao", "pag cartao")


def _centavos(valor: float) -> int:
    return int(round(abs(valor) * 100))


def tem_marcador(descricao: Optional[str]) -> bool:
    # Import tardio: import_service importa este módulo para sugerir na importação.
    from app.services.import_service import normalizar

    norm = normalizar(descricao)
    return any(m in norm for m in MARCADORES_FATURA)


def opcoes(user_id: int, data: str, valor: float, descricao: Optional[str]) -> Dict[str, Any]:
    """
    Faturas que uma saída de `valor` em `data` poderia estar pagando, mais antiga
    primeiro: fechadas na data e ainda com restante. `sugerida` marca as que a
    regra de suspeita aponta; `padrao` é a sugerida mais antiga (ou a mais
    antiga de todas, se nenhuma é sugerida). Vazio quando não há fatura a pagar.
    """
    marcador = tem_marcador(descricao)
    centavos = _centavos(valor)
    lista: List[Dict[str, Any]] = []
    for cartao in cartoes.listar(user_id):
        for f in faturas.listar(cartao, data[:10]):
            if f["state"] not in ("closed", "partially_paid") or f["remaining"] <= 0:
                continue
            igual = centavos in (_centavos(f["total"]), _centavos(f["remaining"]))
            lista.append(
                {
                    "card_id": cartao["id"],
                    "card_name": cartao["name"],
                    "cycle": f["cycle"],
                    "closing_date": f["closing_date"],
                    "due_date": f["due_date"],
                    "total": f["total"],
                    "remaining": f["remaining"],
                    "state": f["state"],
                    "sugerida": igual or marcador,
                }
            )
    lista.sort(key=lambda o: (o["closing_date"], o["card_name"].lower()))
    padrao = next((o for o in lista if o["sugerida"]), lista[0] if lista else None)
    return {
        "opcoes": lista,
        "padrao": {"card_id": padrao["card_id"], "cycle": padrao["cycle"]} if padrao else None,
    }


def eh_suspeito(user_id: int, data: str, valor: float, descricao: Optional[str]) -> bool:
    return any(o["sugerida"] for o in opcoes(user_id, data, valor, descricao)["opcoes"])


def _lancamento(transactions: List[Dict[str, Any]], transaction_id: int) -> Dict[str, Any]:
    t = next((t for t in transactions if t["id"] == transaction_id), None)
    if t is None:
        raise LookupError("Lançamento não encontrado.")
    return t


def _saida_da_conta(t: Dict[str, Any]) -> bool:
    return t["type"] == "expense" and bool(t.get("account_id")) and not t.get("card_id")


def esperando_decisao(t: Dict[str, Any]) -> bool:
    """Linha que o app suspeitou ser pagamento de fatura e aguarda o usuário."""
    return t.get("ingest_state") == "awaiting_reconciliation" and bool(t.get("payment_suspect"))


def opcoes_do_lancamento(transaction_id: int) -> Dict[str, Any]:
    t = _lancamento(DataService.load_json("transactions"), transaction_id)
    if not _saida_da_conta(t):
        raise ValueError("Só uma saída de conta pode ser pagamento de fatura.")
    return opcoes(t["user_id"], t.get("settled_at") or t["due_date"], t["amount"], t.get("description"))


@em_transacao
def confirmar(transaction_id: int, card_id: int, cycle: str) -> Dict[str, Any]:
    """
    Transforma a saída em pagamento da fatura `cycle` do cartão. Serve à linha
    sugerida (que sai da espera) e à marcação manual de qualquer saída efetivada.
    """
    transactions = DataService.load_json("transactions")
    t = _lancamento(transactions, transaction_id)
    if not _saida_da_conta(t):
        raise ValueError("Só uma saída de conta pode ser pagamento de fatura.")
    if t.get("invoice_payment"):
        raise ValueError("Este lançamento já é pagamento de uma fatura.")
    if not esperando_decisao(t) and (t.get("ingest_state", "confirmed") != "confirmed" or not t.get("settled_at")):
        raise ValueError("Só uma saída já efetivada pode ser pagamento de fatura.")
    if t.get("is_internal_transfer"):
        raise ValueError("Este lançamento já é uma transferência.")

    cartao = next((c for c in cartoes.listar(t["user_id"]) if c["id"] == card_id), None)
    if cartao is None:
        raise ValueError("Cartão não encontrado. Escolha um dos seus cartões.")
    # Mesma regra das opções oferecidas: só se paga fatura que já fechou na data
    # da saída e ainda deve. Sem isso o excedente de um pagamento sumiria sem
    # abater nada, e a saída deixaria de ser despesa por engano.
    elegiveis = opcoes(t["user_id"], t.get("settled_at") or t["due_date"], t["amount"], t.get("description"))["opcoes"]
    if not any(o["card_id"] == card_id and o["cycle"] == cycle for o in elegiveis):
        raise ValueError("Essa fatura não está fechada e em aberto na data desta saída.")

    agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    t["ingest_state"] = "confirmed"
    t["payment_suspect"] = False
    t["reconcile_candidate_id"] = None
    t["is_internal_transfer"] = True
    t["invoice_payment"] = {"card_id": card_id, "cycle": cycle}
    t.setdefault("history", []).append({"at": agora, "event": "invoice_payment", "card_id": card_id, "cycle": cycle})
    DataService.save_json("transactions", transactions)
    return t


@em_transacao
def recusar(transaction_id: int) -> Dict[str, Any]:
    """A sugestão estava errada: a linha volta como despesa comum, confirmada."""
    transactions = DataService.load_json("transactions")
    t = _lancamento(transactions, transaction_id)
    if not esperando_decisao(t):
        raise ValueError("Este lançamento não é um pagamento de fatura sugerido.")
    agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    t["ingest_state"] = "confirmed"
    t["payment_suspect"] = False
    t.setdefault("history", []).append({"at": agora, "event": "invoice_payment_rejected"})
    DataService.save_json("transactions", transactions)
    return t
