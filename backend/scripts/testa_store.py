# -*- coding: utf-8 -*-
"""
Critérios de aceite do seam do store (ADR 0001, issue #9).

O store lê e grava coleções inteiras. Os testes de contrato abaixo rodam contra
os DOIS adaptadores (`MemoriaStore` e `JsonStore`): se um comportamento vale
para um e não para o outro, o teste em memória deixa de ser prova do disco.
"""

import os
import shutil
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app.services import import_service as imp  # noqa: E402
from app.services.data_service import DataService  # noqa: E402
from app.services.store import JsonStore, MemoriaStore, usar_store  # noqa: E402

falhas = []


def checa(nome, condicao, detalhe=""):
    print(("  OK    " if condicao else "  FALHA ") + nome + (" -- " + detalhe if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def contrato(rotulo, fabrica):
    """O que qualquer store tem que cumprir, seja qual for o armazenamento."""
    print(rotulo)
    store = fabrica()

    checa("coleção ausente devolve lista vazia", store.load("nada") == [])

    store.save("itens", [{"id": 1, "nome": "café"}])
    checa("gravar e reler devolve o que foi gravado", store.load("itens") == [{"id": 1, "nome": "café"}])

    lido = store.load("itens")
    lido.append({"id": 2})
    lido[0]["nome"] = "outro"
    checa(
        "alterar o que foi lido, sem gravar, não altera o store",
        store.load("itens") == [{"id": 1, "nome": "café"}],
    )

    entrada = [{"id": 3}]
    store.save("outra", entrada)
    entrada.append({"id": 4})
    entrada[0]["id"] = 99
    checa("alterar a lista depois de gravá-la não altera o store", store.load("outra") == [{"id": 3}])

    store.save("itens", [])
    checa("gravar lista vazia substitui o conteúdo", store.load("itens") == [])
    checa("as coleções são independentes entre si", store.load("outra") == [{"id": 3}])

    # transacao(): grava várias coleções de uma vez, tudo ou nada.
    store.save("a", [{"v": "antes"}])
    store.save("b", [{"v": "antes"}])
    with store.transacao():
        store.save("a", [{"v": "depois"}])
        store.save("b", [{"v": "depois"}])
        dentro = (store.load("a"), store.load("b"))
    checa(
        "transacao(): ao terminar, todas as coleções gravadas ficam",
        store.load("a") == [{"v": "depois"}] and store.load("b") == [{"v": "depois"}],
    )
    checa("transacao(): dentro dela, ler enxerga as gravações da própria transação", dentro == ([{"v": "depois"}], [{"v": "depois"}]))

    try:
        with store.transacao():
            store.save("a", [{"v": "perdido"}])
            store.save("novo", [{"v": "perdido"}])
            raise RuntimeError("falha no meio")
    except RuntimeError:
        pass
    checa(
        "transacao(): se o código dentro lança erro, nenhuma coleção muda (nem a que já existia, nem a nova)",
        store.load("a") == [{"v": "depois"}] and store.load("novo") == [],
    )

    with store.transacao():
        store.save("a", [{"v": "externa"}])
        with store.transacao():
            store.save("b", [{"v": "interna"}])
    checa(
        "transacao(): uma dentro da outra vale como uma só",
        store.load("a") == [{"v": "externa"}] and store.load("b") == [{"v": "interna"}],
    )


def json_store():
    """O que só o JsonStore promete: formato, gravação segura, pasta."""
    print("JsonStore (o que só ele promete)")
    tmp = Path(tempfile.mkdtemp(prefix="clari-store-"))
    try:
        # Formato dos arquivos: o mesmo de antes do store (UTF-8, acento sem
        # escape, indentação de 2, quebra de linha do sistema: o antigo
        # `save_json` gravava em modo texto, então no Windows os arquivos reais
        # são CRLF). Comparado com texto literal, não recalculado.
        store = JsonStore(tmp)
        store.save("itens", [{"id": 1, "nome": "café"}])
        esperado = '[\n  {\n    "id": 1,\n    "nome": "café"\n  }\n]'.replace("\n", os.linesep)
        checa(
            "o arquivo tem o formato de sempre (UTF-8, sem escapar acento, indentação 2, quebra do sistema)",
            (tmp / "itens.json").read_bytes().decode("utf-8") == esperado,
        )
        checa("só o arquivo da coleção fica na pasta (nenhum temporário sobra)", sorted(p.name for p in tmp.iterdir()) == ["itens.json"])

        # Um arquivo escrito à mão no formato antigo continua legível.
        (tmp / "antigo.json").write_text('[\n  {"id": 7, "nome": "ação"}\n]', encoding="utf-8")
        checa("lê um arquivo já existente", store.load("antigo") == [{"id": 7, "nome": "ação"}])

        # Serialização que falha não pode apagar o que existia.
        try:
            store.save("itens", [{"id": 2, "invalido": object()}])
            levantou = False
        except TypeError:
            levantou = True
        checa("gravar algo que não vira JSON levanta erro", levantou)
        checa(
            "e o arquivo anterior continua intacto",
            (tmp / "itens.json").read_bytes().decode("utf-8") == esperado,
        )
        checa("e nenhum temporário sobra", sorted(p.name for p in tmp.iterdir()) == ["antigo.json", "itens.json"])

        # transacao(): o conteúdo de todas as coleções é preparado antes de tocar
        # o disco. Se a segunda não serializa, a primeira não é gravada.
        store.save("par", [{"v": "antes"}])
        antes_do_par = (tmp / "par.json").read_bytes()
        try:
            with store.transacao():
                store.save("par", [{"v": "perdido"}])
                store.save("itens", [{"id": 9, "invalido": object()}])
            levantou = False
        except TypeError:
            levantou = True
        checa("transacao(): gravar algo que não vira JSON levanta erro ao concluir", levantou)
        checa(
            "e nenhum arquivo muda, nem o da coleção anterior",
            (tmp / "par.json").read_bytes() == antes_do_par
            and (tmp / "itens.json").read_bytes().decode("utf-8") == esperado,
        )
        checa(
            "e nenhum temporário sobra",
            sorted(p.name for p in tmp.iterdir()) == ["antigo.json", "itens.json", "par.json"],
        )

        # Falha na hora de trocar o arquivo (aqui, o destino é uma pasta): o erro
        # sobe, nada fica pela metade e nenhum temporário sobra.
        (tmp / "bloqueado.json").mkdir()
        try:
            store.save("bloqueado", [{"id": 1}])
            levantou = False
        except OSError:
            levantou = True
        checa("falha ao trocar o arquivo levanta erro", levantou)
        checa(
            "e nenhum temporário sobra",
            sorted(p.name for p in tmp.iterdir()) == ["antigo.json", "bloqueado.json", "itens.json", "par.json"],
        )
        (tmp / "bloqueado.json").rmdir()

        # A pasta é criada quando não existe.
        fundo = JsonStore(tmp / "a" / "b")
        fundo.save("x", [{"id": 1}])
        checa("cria a pasta quando ela não existe", fundo.load("x") == [{"id": 1}])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def memoria_sem_disco():
    print("MemoriaStore (não toca o disco)")
    tmp = Path(tempfile.mkdtemp(prefix="clari-store-"))
    try:
        antes = Path.cwd()
        os.chdir(tmp)
        try:
            store = MemoriaStore()
            store.save("itens", [{"id": 1}])
            store.load("itens")
        finally:
            os.chdir(antes)
        checa("usar o MemoriaStore não cria nenhum arquivo", list(tmp.iterdir()) == [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def servico_usa_o_store():
    """O serviço de dados e a importação falam com o store ativo, não com o disco."""
    print("Serviço de dados e importação passam pelo store ativo")
    tmp = Path(tempfile.mkdtemp(prefix="clari-store-servico-"))
    # Um JsonStore numa pasta temporária faz o papel do store padrão, sem tocar backend/data.
    original = usar_store(JsonStore(tmp))
    try:
        (tmp / "users.json").write_text('[{"id": 1, "name": "Marco"}]', encoding="utf-8")
        checa("com um JsonStore ativo o serviço lê os arquivos da pasta", DataService.load_json("users") == [{"id": 1, "name": "Marco"}])
        DataService.save_json("categories", [{"id": 5}])
        checa("e grava nela", (tmp / "categories.json").exists())

        # Com um MemoriaStore ativo, nada chega ao disco.
        anterior = usar_store(MemoriaStore())
        try:
            checa("com o MemoriaStore ativo o serviço não enxerga o arquivo do disco", DataService.load_json("users") == [])
            conta = DataService.create_account(1, "Bradesco", "checking", 100)
            checa("operações do serviço (criar conta) gravam no store ativo", DataService.get_accounts(1) == [conta])
            csv = "data;descricao;valor\n10/09/2026;Mercado;-12,50\n".encode("utf-8")
            imp.importar(1, "extrato.csv", csv, conta["id"])
            checa(
                "a importação grava no mesmo store ativo",
                [t["description"] for t in DataService.get_transactions_by_user(1)] == ["Mercado"],
            )
            checa(
                "e nada foi escrito no disco",
                sorted(p.name for p in tmp.iterdir()) == ["categories.json", "users.json"],
            )
        finally:
            devolvido = usar_store(anterior)
        checa("usar_store devolve o store que estava ativo", isinstance(devolvido, MemoriaStore))
        checa("restaurar o store anterior volta a ler o disco", DataService.load_json("users") == [{"id": 1, "name": "Marco"}])
    finally:
        usar_store(original)
        shutil.rmtree(tmp, ignore_errors=True)


class FalhaNaGravacao(MemoriaStore):
    """MemoriaStore que levanta erro na n-ésima chamada de `save` (injeção de falha)."""

    def __init__(self, n):
        super().__init__()
        self._n = n
        self._chamadas = 0
        self._armado = False

    def save(self, nome, linhas):
        if self._armado:
            self._chamadas += 1
            if self._chamadas == self._n:
                raise OSError("falha injetada na gravação %d (%s)" % (self._n, nome))
        super().save(nome, linhas)

    def armar(self):
        """Só as gravações depois daqui entram na conta (a montagem do cenário não falha)."""
        self._chamadas = 0
        self._armado = True


def _linha_tx(id, serie, vence, valor=100.0):
    return {
        "id": id, "user_id": 1, "type": "expense", "amount": valor, "description": "Academia",
        "category_id": 1, "due_date": vence, "settled_at": None, "account_id": 1,
        "series_id": serie, "series_index": id if serie else None, "ingest_state": "confirmed",
        "history": [],
    }


def _com_serie(n):
    store = FalhaNaGravacao(n)
    store.save("series", [{
        "id": 1, "user_id": 1, "kind": "recurring", "description": "Academia", "type": "expense",
        "category_id": 1, "account_id": 1, "amount": 100.0, "frequency": "monthly", "anchor_day": 10,
        "start_date": "2026-01-10", "total_count": None, "end_date": None, "ended_at": None,
    }])
    store.save("transactions", [
        _linha_tx(1, 1, "2026-01-10"), _linha_tx(2, 1, "2026-02-10"), _linha_tx(3, 1, "2026-03-10"),
    ])
    store.armar()
    return store


def operacoes_atomicas():
    """Cada operação que grava duas coleções: falha na segunda gravação não deixa a primeira."""
    print("Operações de negócio são tudo ou nada (MemoriaStore com falha injetada)")

    def roda(rotulo, n, preparar, operacao, colecoes):
        """Sem falha a operação muda as coleções; com falha na gravação n, nenhuma muda."""
        controle = preparar(0)
        antes = {c: controle.load(c) for c in colecoes}
        anterior = usar_store(controle)
        try:
            operacao()
        finally:
            usar_store(anterior)
        checa(
            rotulo + ": sem falha, grava as coleções (controle)",
            all(controle.load(c) != antes[c] for c in colecoes),
        )

        store = preparar(n)
        anterior = usar_store(store)
        try:
            try:
                operacao()
                levantou = False
            except OSError:
                levantou = True
        finally:
            usar_store(anterior)
        checa(rotulo + ": falha na gravação %d propaga o erro" % n, levantou)
        checa(
            rotulo + ": e nenhuma coleção ficou alterada",
            all(store.load(c) == antes[c] for c in colecoes),
        )

    roda(
        "editar com escopo de série", 2, _com_serie,
        lambda: DataService.update_transaction(2, {"amount": 55.0}, "all"),
        ("transactions", "series"),
    )
    roda(
        "excluir com escopo de série", 2, _com_serie,
        lambda: DataService.delete_transaction(2, "this_and_future"),
        ("transactions", "series"),
    )

    # Criar série parcelada com as ocorrências: série, parcelas e ajuste da primeira.
    def sem_nada(n):
        store = FalhaNaGravacao(n)
        store.armar()
        return store

    def cria_parcelado():
        DataService.create_transaction(
            1, 1, "expense", 100.0, "2026-01-10", "Geladeira", account_id=1,
            series={"kind": "installment", "frequency": "monthly", "total_count": 3},
        )

    roda("criar série parcelada", 2, sem_nada, cria_parcelado, ("series", "transactions"))
    # A terceira gravação é o ajuste de centavos da primeira parcela (100 / 3).
    store = sem_nada(3)
    anterior = usar_store(store)
    try:
        try:
            cria_parcelado()
            levantou = False
        except OSError:
            levantou = True
    finally:
        usar_store(anterior)
    checa("criar série parcelada: falha na gravação 3 propaga o erro", levantou)
    checa(
        "criar série parcelada: e nem a série nem as parcelas ficaram",
        store.load("series") == [] and store.load("transactions") == [],
    )

    # Importar: lançamentos e o identificador do banco na conta.
    ofx = (
        "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>777</ACCTID></BANKACCTFROM>"
        "<BANKTRANLIST><STMTTRN><DTPOSTED>20260910<TRNAMT>-12.50<FITID>A1<NAME>Mercado</STMTTRN>"
        "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"
    ).encode("utf-8")

    def com_conta(n):
        store = FalhaNaGravacao(n)
        store.save("accounts", [{"id": 1, "user_id": 1, "name": "Bradesco", "kind": "checking", "file_ref": None}])
        store.armar()
        return store

    roda(
        "importar (lançamentos e conta)", 2, com_conta,
        lambda: imp.importar(1, "extrato.ofx", ofx, 1),
        ("transactions", "accounts"),
    )

    # Operações que hoje gravam uma coleção só: passam pela transação (o contrato
    # do ticket), e uma falha na gravação não altera nada.
    def uma_gravacao(rotulo, preparar, operacao):
        store = preparar(1)
        antes = store.load("transactions")
        anterior = usar_store(store)
        try:
            try:
                operacao()
                levantou = False
            except OSError:
                levantou = True
        finally:
            usar_store(anterior)
        checa(rotulo + ": falha na gravação propaga o erro e nada muda", levantou and store.load("transactions") == antes)

    uma_gravacao("exclusão em lote", _com_serie, lambda: DataService.bulk_delete([1, 2]))
    uma_gravacao("adiar", _com_serie, lambda: DataService.postpone_transaction(2, "this_and_future"))
    uma_gravacao("estender séries", _com_serie, lambda: DataService.estender_series(1))

    def em_espera(n):
        store = _com_serie(n)
        store._armado = False  # a montagem do cenário não falha
        linhas = store.load("transactions")
        linhas[2]["ingest_state"] = "awaiting_reconciliation"
        store.save("transactions", linhas)
        store.armar()
        return store

    uma_gravacao("conciliar", em_espera, lambda: imp.conciliar(3, "not_duplicate"))


def main():
    contrato("MemoriaStore", MemoriaStore)
    print()

    tmp = Path(tempfile.mkdtemp(prefix="clari-store-contrato-"))
    try:
        contrato("JsonStore", lambda: JsonStore(tmp))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print()

    json_store()
    print()
    memoria_sem_disco()
    print()
    servico_usa_o_store()
    print()
    operacoes_atomicas()

    print()
    if falhas:
        print("FALHARAM %d critério(s):" % len(falhas))
        for n in falhas:
            print("  -", n)
        sys.exit(1)
    print("Todos os critérios do store passaram.")


if __name__ == "__main__":
    main()
