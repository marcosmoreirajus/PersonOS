from typing import Literal, Optional

from pydantic import BaseModel


class InvoiceUpdate(BaseModel):
    """
    Correção à mão de uma fatura (issue #28). Campo ausente = não mexe;
    `null` = apaga a correção daquele campo (volta ao calculado, ou a "sem
    total declarado"). Datas em AAAA-MM-DD.
    """

    closing_date: Optional[str] = None
    due_date: Optional[str] = None
    declared_total: Optional[float] = None


class InvoiceTotalDecision(BaseModel):
    """Como resolver a diferença entre o total do extrato e a soma das compras."""

    decision: Literal["extract", "purchases"]
