from enum import Enum


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class TransactionSource(str, Enum):
    """De onde o lançamento veio. Nasce com o registro e nunca muda."""

    MANUAL = "manual"
    AI = "ai"
    IMPORT = "import"
    OPEN_FINANCE = "open_finance"


class IngestState(str, Enum):
    """
    Estado de ingestão — eixo separado do ciclo de vida do lançamento.

    Ciclo de vida ("vai acontecer × aconteceu") é derivado de `settled_at` +
    `due_date` e não é gravado. Este campo responde outra pergunta ("é confiável
    × está em análise"), e por isso não pode dividir campo com aquele: uma
    parcela futura suspeita de duplicidade é as duas coisas ao mesmo tempo.

    Regra inegociável: nenhuma leitura agregada — saldo, dashboard, relatórios,
    listagem padrão — enxerga o que não está `CONFIRMED`.
    """

    CONFIRMED = "confirmed"
    AWAITING_RECONCILIATION = "awaiting_reconciliation"


class SeriesKind(str, Enum):
    """
    Parcelado tem um todo, fim conhecido e soma que faz sentido; recorrente não
    tem nenhum dos três. O que decide materializar todas as ocorrências, porém,
    é ter fim conhecido (`total_count` ou `end_date`), não este campo.
    """

    INSTALLMENT = "installment"
    RECURRING = "recurring"


class SeriesFrequency(str, Enum):
    MONTHLY = "monthly"
    BIWEEKLY = "biweekly"
    WEEKLY = "weekly"


class Scope(str, Enum):
    """Alcance de editar, excluir e pular — a mesma pergunta nas três."""

    ONLY_THIS = "only_this"
    THIS_AND_FUTURE = "this_and_future"
    ALL = "all"


class CategoryType(str, Enum):
    """
    A que lado da transação a categoria pertence.

    `BOTH` existe para o guarda-chuva ("Outros"), que serve aos dois. Sem esse
    campo o formulário oferece "Salário" para uma despesa — um par que o
    usuário escolhe sem perceber e que envenena o relatório depois.
    """

    EXPENSE = "expense"
    INCOME = "income"
    BOTH = "both"


class AccountKind(str, Enum):
    """
    Onde o dinheiro vive. Uma conta por banco: "Bradesco" e "C6" são contas
    diferentes, e é isso que permite reconhecer o mesmo extrato importado duas
    vezes sem confundi-lo com a mesma linha em outro banco.
    """

    CHECKING = "checking"
    CARD = "card"
    WALLET = "wallet"

