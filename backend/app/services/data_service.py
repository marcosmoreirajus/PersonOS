from datetime import date, datetime, timedelta, timezone
from functools import wraps
from typing import List, Dict, Any

from app.conta_logos import logo_valido
from app.services import despesa_liquida, series_engine
from app.services.store import store_ativo


def em_transacao(funcao):
    """
    Faz a operação gravar no store ativo numa `transacao()`: tudo ou nada.

    As operações que gravam mais de uma coleção (lançamentos e séries, ou
    lançamentos e contas) usam isto, para uma falha no meio não deixar os dados
    incoerentes. A assinatura da função não muda.
    """

    @wraps(funcao)
    def envolvida(*args, **kwargs):
        with store_ativo().transacao():
            return funcao(*args, **kwargs)

    return envolvida


class DataService:
    """Serviço de dados mock usando JSON files."""

    @staticmethod
    def load_json(filename: str) -> List[Dict[str, Any]]:
        """Carrega uma coleção do store ativo."""
        return store_ativo().load(filename)

    @staticmethod
    def save_json(filename: str, data: List[Dict[str, Any]]) -> None:
        """Grava uma coleção no store ativo (o JsonStore gera o conteúdo antes
        de tocar o arquivo, para não perder o original se a serialização falhar
        — ver nota do Módulo Negócio sobre esse mesmo cuidado)."""
        store_ativo().save(filename, data)

    @staticmethod
    def get_users() -> List[Dict[str, Any]]:
        """Retorna lista de usuários."""
        return DataService.load_json("users")

    @staticmethod
    def get_user_by_id(user_id: int) -> Dict[str, Any] | None:
        """Retorna um usuário pelo ID."""
        users = DataService.get_users()
        return next((u for u in users if u["id"] == user_id), None)

    @staticmethod
    def get_categories() -> List[Dict[str, Any]]:
        """Retorna lista de categorias."""
        return DataService.load_json("categories")

    @staticmethod
    def get_category_by_id(category_id: int) -> Dict[str, Any] | None:
        """Retorna uma categoria pelo ID."""
        categories = DataService.get_categories()
        return next((c for c in categories if c["id"] == category_id), None)

    # ------------------------------------------------------------------ #
    # Transações
    #
    # `previsto / atrasado / realizado` NÃO é campo: deriva de `settled_at`
    # (nulo até o dinheiro se mover) com `due_date`. E `ingest_state` é um
    # eixo separado — nenhuma leitura agregada enxerga o que não está
    # confirmado. Ver docs/finance/spec.md.
    # ------------------------------------------------------------------ #

    @staticmethod
    def get_transactions(include_unconfirmed: bool = False) -> List[Dict[str, Any]]:
        """Todas as transações. Por padrão só as confirmadas."""
        transactions = DataService.load_json("transactions")
        if include_unconfirmed:
            return transactions
        return [t for t in transactions if t.get("ingest_state", "confirmed") == "confirmed"]

    @staticmethod
    def get_transactions_by_user(
        user_id: int, include_unconfirmed: bool = False
    ) -> List[Dict[str, Any]]:
        """Transações de um usuário. Por padrão só as confirmadas."""
        transactions = DataService.get_transactions(include_unconfirmed)
        return [t for t in transactions if t["user_id"] == user_id]

    @staticmethod
    def get_settled_by_user(user_id: int) -> List[Dict[str, Any]]:
        """
        Só o que já aconteceu — a base de saldo, cards e relatórios.

        Lançamento previsto (e o atrasado, que também não foi pago) fica de
        fora: contá-lo faria o saldo afirmar um dinheiro que não se moveu.
        """
        return [t for t in DataService.get_transactions_by_user(user_id) if t.get("settled_at")]

    @staticmethod
    @em_transacao
    def create_transaction(
        user_id: int,
        category_id: int,
        type: str,
        amount: float,
        due_date: str,
        description: str | None = None,
        settled_at: str | None = None,
        account_id: int | None = None,
        is_internal_transfer: bool = False,
        source: str = "manual",
        series: Dict[str, Any] | None = None,
        card_id: int | None = None,
    ) -> Dict[str, Any]:
        """
        Cria uma transação nova e persiste em transactions.json.

        A geração das demais ocorrências quando vem `series` é da Fatia 2;
        aqui a série é criada e o lançamento já nasce vinculado a ela.
        """
        transactions = DataService.load_json("transactions")
        next_id = max((t["id"] for t in transactions), default=0) + 1
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        series_id = None
        if series:
            # Parcelado recebe o TOTAL e guarda o valor da PARCELA: é a parcela
            # que aparece na fatura e que a importação vai tentar casar. O
            # total continua sendo a soma, nunca um campo — a diferença de
            # centavos da divisão vai para a primeira parcela, logo abaixo.
            valor_parcela = amount
            n = series.get("total_count")
            if series.get("kind") == "installment" and n:
                # Trunca para baixo em vez de arredondar: assim a sobra é
                # sempre positiva e a primeira parcela fica sempre a MAIOR,
                # que é a convenção. Arredondando, 100 em 7x daria parcela de
                # 14,29 e primeira de 14,26 — a menor de todas.
                import math

                valor_parcela = math.floor(amount / n * 100) / 100
            series_id = DataService.create_series(
                user_id=user_id,
                kind=series["kind"],
                description=description or "",
                type=type,
                category_id=category_id,
                account_id=account_id,
                amount=valor_parcela,
                frequency=series.get("frequency", "monthly"),
                start_date=due_date,
                total_count=series.get("total_count"),
                end_date=series.get("end_date"),
            )["id"]

        # Série com fim conhecido gera tudo; indefinida, os 12 meses da
        # janela. A primeira ocorrência sai daqui junto das demais, em vez de
        # ser criada à mão e as outras depois — duas origens para o mesmo
        # registro divergiriam no dia em que uma das duas mudasse.
        if series_id is not None:
            criada = DataService.gerar_ocorrencias_da_serie(series_id, transactions)
            if criada:
                # A sobra de centavos só existe em parcelamento, onde o valor
                # informado é o TOTAL. Numa recorrência o valor informado é o
                # da própria ocorrência, e aplicar o ajuste ali "corrigia" a
                # primeira para `total - soma das outras` (uma recorrência de
                # 39,90 gerava a primeira ocorrência em -399,00).
                if series["kind"] == "installment":
                    DataService._ajustar_primeira_parcela(series_id, amount)
                return criada[0]

        history = [{"at": now, "event": "created", "source": source}]
        if settled_at:
            history.append({"at": now, "event": "settled", "on": settled_at})

        new_transaction = {
            "id": next_id,
            "user_id": user_id,
            "type": type,
            "amount": amount,
            "description": description,
            "category_id": category_id,
            "due_date": due_date,
            "settled_at": settled_at,
            "account_id": account_id,
            # Compra no cartão: aponta o Cartão, sem Conta. A Fatura é derivada
            # (faturas.py), então `invoice_id` segue nulo.
            "card_id": card_id,
            "invoice_id": None,
            "is_internal_transfer": is_internal_transfer,
            "needs_transfer_review": False,
            "series_id": series_id,
            "series_index": 1 if series_id else None,
            "ingest_state": "confirmed",
            "source": source,
            "external_id": None,
            "import_hash": None,
            "history": history,
            "created_at": now,
        }

        transactions.append(new_transaction)
        DataService.save_json("transactions", transactions)
        return new_transaction


    @staticmethod
    def _alvos_do_escopo(
        transactions: List[Dict[str, Any]], alvo: Dict[str, Any], scope: str
    ) -> List[Dict[str, Any]]:
        """
        Quais registros uma operação em lote atinge.

        `only_this` sempre vale, inclusive para lançamento avulso. Os outros
        dois só fazem sentido dentro de uma série, e nunca alcançam o que já
        foi efetivado: o que aconteceu não se reescreve — apagar uma parcela
        paga não cancela o gasto, só faz o app discordar do extrato.
        """
        if scope == "only_this" or not alvo.get("series_id"):
            return [alvo]

        da_serie = [t for t in transactions if t.get("series_id") == alvo["series_id"]]
        if scope == "this_and_future":
            da_serie = [t for t in da_serie if t["due_date"] >= alvo["due_date"]]
        return [t for t in da_serie if not t.get("settled_at") or t["id"] == alvo["id"]]

    @staticmethod
    @em_transacao
    def update_transaction(
        transaction_id: int, changes: Dict[str, Any], scope: str = "only_this"
    ) -> Dict[str, Any] | None:
        """
        Edita uma transação e, em escopo de série, também o molde.

        Editar "esta e as futuras" precisa atualizar a série: sem isso, a
        próxima extensão da janela geraria a ocorrência nova com o valor
        antigo, desfazendo em silêncio o que o usuário acabou de decidir.
        """
        transactions = DataService.load_json("transactions")
        alvo = next((t for t in transactions if t["id"] == transaction_id), None)
        if alvo is None:
            return None

        agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        campos = {k: v for k, v in changes.items() if v is not None}

        for registro in DataService._alvos_do_escopo(transactions, alvo, scope):
            for campo, valor in campos.items():
                anterior = registro.get(campo)
                if anterior == valor:
                    continue
                registro[campo] = valor
                evento = {
                    "amount": "amount_changed",
                    "due_date": "due_date_moved",
                    "category_id": "category_set",
                }.get(campo)
                if evento:
                    registro.setdefault("history", []).append(
                        {"at": agora, "event": evento, "from": anterior, "to": valor}
                    )

        if scope in ("this_and_future", "all") and alvo.get("series_id"):
            series = DataService.load_json("series")
            molde = next((s for s in series if s["id"] == alvo["series_id"]), None)
            if molde:
                for campo in ("amount", "category_id", "description"):
                    if campo in campos:
                        molde[campo] = campos[campo]
                DataService.save_json("series", series)

        DataService.save_json("transactions", transactions)
        return alvo

    @staticmethod
    @em_transacao
    def delete_transaction(transaction_id: int, scope: str = "only_this") -> int:
        """
        Exclui e, em escopo de série, encerra a série.

        Sem gravar o fim no molde, a próxima extensão da janela ressuscitaria
        a assinatura que o usuário acabou de cancelar.
        """
        transactions = DataService.load_json("transactions")
        alvo = next((t for t in transactions if t["id"] == transaction_id), None)
        if alvo is None:
            return 0

        alvos = DataService._alvos_do_escopo(transactions, alvo, scope)
        ids = {t["id"] for t in alvos}
        restantes = [t for t in transactions if t["id"] not in ids]
        DataService.save_json("transactions", restantes)

        if scope in ("this_and_future", "all") and alvo.get("series_id"):
            series = DataService.load_json("series")
            molde = next((s for s in series if s["id"] == alvo["series_id"]), None)
            if molde:
                molde["ended_at"] = alvo["due_date"]
                DataService.save_json("series", series)

        return len(ids)

    @staticmethod
    def bulk_update(ids: List[int], changes: Dict[str, Any]) -> int:
        """
        Aplica a mesma mudança a vários lançamentos.

        Cada item é tratado como `only_this`: uma seleção na tela é um
        conjunto escolhido a dedo, não uma série — estender a mudança para as
        ocorrências futuras de cada um seria fazer mais do que foi pedido.
        """
        transactions = DataService.load_json("transactions")
        agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        campos = {k: v for k, v in changes.items() if v is not None}
        alvos = [t for t in transactions if t["id"] in set(ids)]

        for registro in alvos:
            for campo, valor in campos.items():
                anterior = registro.get(campo)
                if anterior == valor:
                    continue
                registro[campo] = valor
                evento = {
                    "amount": "amount_changed",
                    "due_date": "due_date_moved",
                    "category_id": "category_set",
                }.get(campo)
                if evento:
                    registro.setdefault("history", []).append(
                        {"at": agora, "event": evento, "from": anterior, "to": valor, "bulk": True}
                    )

        DataService.save_json("transactions", transactions)
        return len(alvos)

    @staticmethod
    @em_transacao
    def bulk_delete(ids: List[int]) -> int:
        """Exclui vários lançamentos. Não encerra série: seleção não é série."""
        transactions = DataService.load_json("transactions")
        alvo = set(ids)
        restantes = [t for t in transactions if t["id"] not in alvo]
        removidas = len(transactions) - len(restantes)
        DataService.save_json("transactions", restantes)
        return removidas


    @staticmethod
    def _ajustar_primeira_parcela(series_id: int, total: float) -> None:
        """
        Joga a sobra da divisão na **primeira** parcela.

        Sem o ajuste, 1.000 em 3x viraria 333,33 x3 = 999,99 e o total exibido
        (que é a soma das parcelas) deixaria de bater com o que o usuário
        digitou.

        A sobra vai na primeira porque é essa a convenção do crédito
        parcelado no Brasil — cartão, carnê e crediário cobram a diferença na
        entrada. Pôr no fim faria o app discordar da fatura justamente na
        parcela que o usuário confere primeiro, logo depois de comprar.
        """
        transactions = DataService.load_json("transactions")
        parcelas = sorted(
            [t for t in transactions if t.get("series_id") == series_id],
            key=lambda t: t["due_date"],
        )
        if len(parcelas) < 2:
            return

        soma_seguintes = sum(t["amount"] for t in parcelas[1:])
        primeira = round(total - soma_seguintes, 2)
        if primeira != parcelas[0]["amount"]:
            parcelas[0]["amount"] = primeira
            DataService.save_json("transactions", transactions)

    # ------------------------------------------------------------------ #
    # Contas (mínimo — Fatia 3)
    # ------------------------------------------------------------------ #

    @staticmethod
    def get_accounts(user_id: int) -> List[Dict[str, Any]]:
        """Contas do usuário, em ordem alfabética."""
        contas = [a for a in DataService.load_json("accounts") if a["user_id"] == user_id]
        return sorted(contas, key=lambda a: a["name"].lower())

    @staticmethod
    def validar_conta_do_usuario(user_id: int, account_id: int | None, obrigatoria: bool = False) -> None:
        """
        Confere a conta que a rota de transações recebeu; `ValueError` com frase
        quando não serve. É da ROTA, não de `create_transaction`: séries,
        transferência, importação e "Pagar" criam lançamento por dentro, e
        alguns nascem legitimamente sem conta.
        """
        if account_id is None:
            if obrigatoria:
                raise ValueError("Escolha a conta do lançamento.")
            return
        # Conta de outro usuário não vale nem pode vazar que existe.
        if not any(a["id"] == account_id for a in DataService.get_accounts(user_id)):
            raise ValueError("Conta não encontrada. Escolha uma das suas contas.")

    @staticmethod
    def _nome_em_uso(contas: List[Dict[str, Any]], user_id: int, nome: str, ignorar_id: int | None = None) -> bool:
        alvo = " ".join(nome.lower().split())
        return any(
            a["user_id"] == user_id
            and a["id"] != ignorar_id
            and " ".join(a["name"].lower().split()) == alvo
            for a in contas
        )

    @staticmethod
    def _logo_valido(logo: str | None) -> str | None:
        """
        O logo é sempre um item da coleção fechada (`app/conta_logos.py`):
        uma instituição ou um ícone sobre uma cor da paleta. Imagem enviada
        não é aceita.
        """
        if not logo:
            return None
        if not logo_valido(logo):
            raise ValueError("Escolha um dos logos da lista.")
        return logo

    @staticmethod
    def create_account(
        user_id: int,
        name: str,
        kind: str = "checking",
        initial_balance: float = 0,
        logo: str | None = None,
        exclude_from_total: bool = False,
    ) -> Dict[str, Any]:
        """
        Cria uma conta. O nome é único por usuário (sem diferenciar caixa nem
        espaços repetidos): duas contas "Bradesco" fariam o usuário escolher a
        errada na importação, e o erro só apareceria como lançamentos no lugar
        errado.
        """
        nome = " ".join(name.split())
        if not nome:
            raise ValueError("Dê um nome para a conta.")
        contas = DataService.load_json("accounts")
        if DataService._nome_em_uso(contas, user_id, nome):
            raise ValueError("Já existe uma conta com esse nome.")

        nova = {
            "id": max((a["id"] for a in contas), default=0) + 1,
            "user_id": user_id,
            "name": nome,
            "kind": kind,
            # Saldo de abertura informado pelo usuário. Só é guardado: ainda não
            # entra nas somas de saldo das telas.
            "initial_balance": round(float(initial_balance), 2),
            "logo": DataService._logo_valido(logo),
            # Conta de dinheiro guardado (poupança, investimento): o saldo dela
            # continua nos lançamentos e relatórios, mas não entra no Saldo Geral.
            "exclude_from_total": bool(exclude_from_total),
            # Identificador que o banco põe no arquivo (ACCTID do OFX). Guardado
            # na primeira importação e usado para avisar quando um arquivo de
            # outra conta é enviado para esta.
            "file_ref": None,
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        contas.append(nova)
        DataService.save_json("accounts", contas)
        return nova

    @staticmethod
    def update_account(
        account_id: int,
        name: str | None = None,
        kind: str | None = None,
        initial_balance: float | None = None,
        logo: str | None = None,
        exclude_from_total: bool | None = None,
    ) -> Dict[str, Any] | None:
        contas = DataService.load_json("accounts")
        conta = next((a for a in contas if a["id"] == account_id), None)
        if conta is None:
            return None
        if name is not None:
            nome = " ".join(name.split())
            if not nome:
                raise ValueError("Dê um nome para a conta.")
            if DataService._nome_em_uso(contas, conta["user_id"], nome, ignorar_id=account_id):
                raise ValueError("Já existe uma conta com esse nome.")
            conta["name"] = nome
        if kind is not None:
            conta["kind"] = kind
        if initial_balance is not None:
            conta["initial_balance"] = round(float(initial_balance), 2)
        if logo is not None:
            # string vazia remove o logo
            conta["logo"] = DataService._logo_valido(logo)
        if exclude_from_total is not None:
            conta["exclude_from_total"] = bool(exclude_from_total)
        DataService.save_json("accounts", contas)
        return conta

    # ------------------------------------------------------------------ #
    # Geração de séries (Fatia 2)
    # ------------------------------------------------------------------ #

    @staticmethod
    def gerar_ocorrencias_da_serie(
        series_id: int, transactions: List[Dict[str, Any]] | None = None
    ) -> List[Dict[str, Any]]:
        """Materializa o que falta de uma série e persiste."""
        transactions = transactions if transactions is not None else DataService.load_json("transactions")
        serie = next((s for s in DataService.load_json("series") if s["id"] == series_id), None)
        if serie is None:
            return []

        agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        proximo = max((t["id"] for t in transactions), default=0) + 1
        novas = series_engine.gerar(serie, transactions, date.today(), agora, proximo)
        if novas:
            transactions.extend(novas)
            DataService.save_json("transactions", transactions)
        return novas

    @staticmethod
    @em_transacao
    def estender_series(user_id: int) -> Dict[str, Any]:
        """
        Roda a janela de todas as séries ativas do usuário.

        Idempotente de propósito: é chamada na virada do mês e ao navegar
        para um mês distante, e as duas podem acontecer na mesma sessão. A
        chave é (série, vencimento), então repetir não duplica.

        Série encerrada não entra — é o que impede a assinatura cancelada de
        voltar na próxima extensão.
        """
        transactions = DataService.load_json("transactions")
        series = [
            s
            for s in DataService.load_json("series")
            if s["user_id"] == user_id and not s.get("ended_at")
        ]

        agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        hoje = date.today()
        criadas: List[Dict[str, Any]] = []

        for serie in series:
            proximo = max((t["id"] for t in transactions), default=0) + 1
            novas = series_engine.gerar(serie, transactions, hoje, agora, proximo)
            transactions.extend(novas)
            criadas.extend(novas)

        if criadas:
            DataService.save_json("transactions", transactions)

        atrasadas = sum(1 for t in criadas if t["due_date"] < hoje.isoformat())
        return {"geradas": len(criadas), "atrasadas": atrasadas}

    @staticmethod
    def projetar_series(user_id: int, de: str, ate: str) -> List[Dict[str, Any]]:
        """
        Ocorrências calculadas de um intervalo, sem gravar nada.

        Leitura projeta, escrita materializa: navegar para um mês distante
        mostra o que está previsto sem criar dado que ninguém pediu.
        """
        transactions = DataService.load_json("transactions")
        materializadas = {
            (t.get("series_id"), t["due_date"]) for t in transactions if t.get("series_id")
        }

        inicio = date(int(de[:4]), int(de[5:7]), int(de[8:10]))
        fim = date(int(ate[:4]), int(ate[5:7]), int(ate[8:10]))

        fora = []
        for serie in DataService.load_json("series"):
            if serie["user_id"] != user_id or serie.get("ended_at"):
                continue
            for proj in series_engine.projetar(serie, inicio, fim):
                if (serie["id"], proj["due_date"]) not in materializadas:
                    fora.append(proj)
        return fora

    @staticmethod
    def settle_transaction(transaction_id: int, on: str | None = None) -> Dict[str, Any] | None:
        """Marca a efetivação. Sem data informada, é hoje."""
        quando = on or date.today().isoformat()
        return DataService.update_transaction(transaction_id, {"settled_at": quando}, "only_this")

    @staticmethod
    @em_transacao
    def postpone_transaction(transaction_id: int, scope: str = "only_this") -> int:
        """
        Adia um vencimento em um período da série (ou um mês, se avulso).

        Pular é adiamento, não dispensa: o compromisso continua existindo com
        data nova, e por isso **não toca o molde** — a série retoma o ritmo.
        O rastro de que a data mudou fica no evento `due_date_moved`.
        """
        transactions = DataService.load_json("transactions")
        alvo = next((t for t in transactions if t["id"] == transaction_id), None)
        if alvo is None:
            return 0

        serie = None
        if alvo.get("series_id"):
            serie = next(
                (s for s in DataService.load_json("series") if s["id"] == alvo["series_id"]), None
            )
        frequencia = (serie or {}).get("frequency", "monthly")

        agora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        alvos = DataService._alvos_do_escopo(transactions, alvo, scope)

        for registro in alvos:
            atual = series_engine._parse(registro["due_date"])
            if frequencia == "monthly":
                nova = series_engine._soma_meses(atual, 1, atual.day)
            elif frequencia == "biweekly":
                nova = atual + timedelta(days=14)
            else:
                nova = atual + timedelta(days=7)
            anterior = registro["due_date"]
            registro["due_date"] = nova.isoformat()
            registro.setdefault("history", []).append(
                {"at": agora, "event": "due_date_moved", "from": anterior, "to": registro["due_date"]}
            )

        DataService.save_json("transactions", transactions)
        return len(alvos)

    # ------------------------------------------------------------------ #
    # Séries (recorrência e parcelamento)
    # ------------------------------------------------------------------ #

    @staticmethod
    def get_series(user_id: int) -> List[Dict[str, Any]]:
        """Séries de um usuário. `ended_at` preenchido = encerrada."""
        return [s for s in DataService.load_json("series") if s["user_id"] == user_id]

    @staticmethod
    def create_series(
        user_id: int,
        kind: str,
        description: str,
        type: str,
        category_id: int | None,
        amount: float,
        frequency: str,
        start_date: str,
        account_id: int | None = None,
        total_count: int | None = None,
        end_date: str | None = None,
    ) -> Dict[str, Any]:
        """
        Cria a série. O total da dívida nunca é gravado — é a soma das
        parcelas, pra não existirem dois números concorrentes quando uma
        parcela vier com juros.
        """
        series = DataService.load_json("series")
        next_id = max((s["id"] for s in series), default=0) + 1

        new_series = {
            "id": next_id,
            "user_id": user_id,
            "kind": kind,
            "description": description,
            "type": type,
            "category_id": category_id,
            "account_id": account_id,
            "amount": amount,
            "frequency": frequency,
            "anchor_day": int(start_date[8:10]),
            "start_date": start_date,
            "total_count": total_count,
            "end_date": end_date,
            "ended_at": None,
        }

        series.append(new_series)
        DataService.save_json("series", series)
        return new_series

    @staticmethod
    def get_investments(user_id: int) -> Dict[str, Any]:
        """Retorna a carteira de investimentos (holdings + config de Coast FI) de um usuário."""
        all_data = DataService.load_json("investments")
        return next((i for i in all_data if i["user_id"] == user_id), {})

    # ------------------------------------------------------------------ #
    # Preferências do usuário (issue #2: avisos do sino)
    #
    # Ficam no backend, não no navegador: o "visto" num aparelho vale em
    # todos. Tema e modo privacidade continuam no localStorage — são do
    # aparelho, não da pessoa.
    # ------------------------------------------------------------------ #

    PREFERENCIAS_PADRAO: Dict[str, Any] = {
        "em_atraso": True,
        "a_vencer": True,
        "janela_a_vencer": 7,
        "visto": [],
    }

    @staticmethod
    def get_preferences(user_id: int) -> Dict[str, Any]:
        """Preferências gravadas, completadas pelos padrões. Ler não grava."""
        gravada = next((p for p in DataService.load_json("preferences") if p["user_id"] == user_id), {})
        # Lista nova a cada leitura: a do padrão não pode ser compartilhada.
        return {"user_id": user_id, **DataService.PREFERENCIAS_PADRAO, "visto": [], **gravada}

    @staticmethod
    def update_preferences(user_id: int, mudancas: Dict[str, Any]) -> Dict[str, Any]:
        """Grava só os campos enviados; o resto continua como estava."""
        todas = DataService.load_json("preferences")
        atual = DataService.get_preferences(user_id)
        atual.update({k: v for k, v in mudancas.items() if k in DataService.PREFERENCIAS_PADRAO})
        todas = [p for p in todas if p["user_id"] != user_id] + [atual]
        DataService.save_json("preferences", todas)
        return atual

    @staticmethod
    def get_review(user_id: int) -> Dict[str, Any]:
        """
        A fila "A revisar": o que falta o usuário resolver, num lugar só.

        É o único leitor de `awaiting_reconciliation` (regra do spec). Sem
        categoria entram confirmadas e já efetivadas, de qualquer tipo — o
        mesmo recorte do balde do relatório. Previsto fica de fora: uma
        recorrência sem categoria poria 12 ocorrências na fila, e classificar
        uma não resolveria as outras. Transferência interna também fica, por
        não ter categoria a dar. Não é aviso de prazo: ver GLOSSARY.md.
        """
        todas = DataService.get_transactions_by_user(user_id, include_unconfirmed=True)
        por_id = {t["id"]: t for t in todas}

        def recente_primeiro(t: Dict[str, Any]) -> tuple:
            return (t.get("settled_at") or t.get("due_date") or "", t["id"])

        # Import tardio: pagamentos_fatura importa este módulo.
        from app.services import pagamentos_fatura

        a_conciliar = []
        pagamentos_fatura_pendentes = []
        for t in todas:
            if t.get("ingest_state") != "awaiting_reconciliation":
                continue
            if t.get("payment_suspect"):
                pagamentos_fatura_pendentes.append(
                    {**t, **pagamentos_fatura.opcoes(user_id, t.get("settled_at") or t["due_date"], t["amount"], t.get("description"))}
                )
                continue
            # O candidato pode ter sido excluído depois da importação: a linha
            # continua na fila, só sem o comparativo.
            cand = por_id.get(t.get("reconcile_candidate_id"))
            a_conciliar.append({**t, "candidato": {
                "id": cand["id"],
                "description": cand["description"],
                "amount": cand["amount"],
                "due_date": cand["due_date"],
                "settled_at": cand.get("settled_at"),
            } if cand else None})

        sem_categoria = [
            t for t in todas
            if t.get("ingest_state", "confirmed") == "confirmed"
            and t.get("settled_at")
            and t.get("category_id") is None
            and not t.get("is_internal_transfer")
        ]

        a_conciliar.sort(key=recente_primeiro, reverse=True)
        pagamentos_fatura_pendentes.sort(key=recente_primeiro, reverse=True)
        sem_categoria.sort(key=recente_primeiro, reverse=True)
        return {
            "a_conciliar": a_conciliar,
            "pagamentos_fatura": pagamentos_fatura_pendentes,
            "sem_categoria": sem_categoria,
            "total": len(a_conciliar) + len(pagamentos_fatura_pendentes) + len(sem_categoria),
        }

    @staticmethod
    def get_dashboard_summary(user_id: int) -> Dict[str, Any]:
        """Retorna resumo para dashboard."""
        # Só o efetivado: o previsto existe em transactions desde a fonte
        # única, mas não pode somar em saldo/cards/relatórios.
        transactions = DataService.get_settled_by_user(user_id)
        # Transferência interna é dinheiro trocando de bolso: fora de
        # receita, despesa, saldo e relatórios (spec). Continua nas "últimas",
        # que é lista e não soma — como em Transações.
        somaveis = [t for t in transactions if not t.get("is_internal_transfer")]

        income = sum(t["amount"] for t in somaveis if t["type"] == "income")
        expense = despesa_liquida.total(somaveis)
        # `balance` continua sendo receita menos despesa (o Resultado: o
        # testa_fatia4 e quem já o lê dependem disso). O Saldo da página é
        # `accounts_balance["total"]`, a soma dos saldos das contas.
        from app.services.saldos import saldos_por_conta  # import tardio: saldos importa este módulo

        balance = income - expense
        accounts_balance = saldos_por_conta(user_id)

        # Despesas por categoria. O nulo NÃO vira uma categoria: vai num balde
        # à parte, que o relatório mostra fora da escala das categorias reais
        # (ver "Balde virtual" no spec). Antes caía em "Outro", misturado com
        # "Outros", que é escolha deliberada.
        expenses_by_category = {}
        uncategorized_expense = 0
        for t in somaveis:
            if not despesa_liquida.eh_despesa_liquida(t):
                continue
            cat_id = t.get("category_id")
            if cat_id is None:
                uncategorized_expense += despesa_liquida.valor(t)
                continue
            category = DataService.get_category_by_id(cat_id)
            cat_name = category["name"] if category else "Outro"
            expenses_by_category[cat_name] = round(expenses_by_category.get(cat_name, 0) + despesa_liquida.valor(t), 2)

        return {
            "balance": balance,
            "accounts_balance": accounts_balance,
            "income": income,
            "expense": expense,
            "expenses_by_category": expenses_by_category,
            "uncategorized_expense": uncategorized_expense,
            "recent_transactions": sorted(transactions, key=lambda x: x["settled_at"], reverse=True)[:5],
        }
