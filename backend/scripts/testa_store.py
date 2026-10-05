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

from app.services import data_service  # noqa: E402
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

        # A pasta pode ser dada por função, resolvida a cada uso.
        destino = {"pasta": tmp / "um"}
        dinamico = JsonStore(lambda: destino["pasta"])
        dinamico.save("y", [{"id": 1}])
        destino["pasta"] = tmp / "dois"
        checa("com pasta dada por função, trocar a pasta troca onde lê", dinamico.load("y") == [])
        dinamico.save("y", [{"id": 2}])
        checa(
            "e onde grava",
            (tmp / "um" / "y.json").exists() and (tmp / "dois" / "y.json").exists(),
        )
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
    pasta_original = data_service.DATA_DIR
    data_service.DATA_DIR = tmp
    try:
        # Sem trocar nada, o padrão é o JsonStore na pasta de dados do serviço.
        (tmp / "users.json").write_text('[{"id": 1, "name": "Marco"}]', encoding="utf-8")
        checa("por padrão o serviço lê os arquivos da pasta de dados", DataService.load_json("users") == [{"id": 1, "name": "Marco"}])
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
        data_service.DATA_DIR = pasta_original
        shutil.rmtree(tmp, ignore_errors=True)


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
    if falhas:
        print("FALHARAM %d critério(s):" % len(falhas))
        for n in falhas:
            print("  -", n)
        sys.exit(1)
    print("Todos os critérios do store passaram.")


if __name__ == "__main__":
    main()
