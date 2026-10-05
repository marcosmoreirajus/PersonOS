"""
Store: o limite entre a regra de negócio e o armazenamento (ADR 0001).

A interface é de **coleção inteira** de propósito: `load(nome)` devolve todas as
linhas e `save(nome, linhas)` as substitui. Operações por entidade (`add`,
`update`, `delete`) ficam para quando o banco entrar; desenhá-las agora seria
modelar para um adaptador que ainda não existe.

Contrato que todo adaptador cumpre:
- coleção ausente devolve lista vazia;
- o que `load` devolve e o que `save` recebe são cópias independentes: alterar
  uma lista sem gravar não muda o store;
- `transacao()` agrupa gravações de várias coleções: ou todas ficam, ou nenhuma.
  Dentro dela, `load` enxerga as gravações da própria transação. Se o bloco
  lança erro, nada é gravado. Uma transação dentro de outra vale como uma só.
"""

import copy
import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, ContextManager, Dict, Iterator, List, Optional, Protocol, Union

Linhas = List[Dict[str, Any]]

# A pasta dos dados reais: o store padrão aponta para ela.
PASTA_DE_DADOS = Path(__file__).parent.parent.parent / "data"


class Store(Protocol):
    """A interface que todo adaptador cumpre (hoje JSON e memória; o banco será o terceiro)."""

    def load(self, nome: str) -> Linhas: ...

    def save(self, nome: str, linhas: Linhas) -> None: ...

    def transacao(self) -> ContextManager[None]: ...


class _StoreComTransacao:
    """
    A parte comum aos adaptadores: dentro de `transacao()`, as gravações ficam
    num buffer (que `load` já enxerga) e só vão para o armazenamento ao sair do
    bloco sem erro, todas de uma vez. Cada adaptador define `_ler` e `_gravar`.
    """

    def __init__(self) -> None:
        self._pendente: Optional[Dict[str, Linhas]] = None

    def _ler(self, nome: str) -> Linhas:
        raise NotImplementedError

    def _gravar(self, colecoes: Dict[str, Linhas]) -> None:
        """Grava todas as coleções recebidas, ou nenhuma."""
        raise NotImplementedError

    def load(self, nome: str) -> Linhas:
        if self._pendente is not None and nome in self._pendente:
            return copy.deepcopy(self._pendente[nome])
        return self._ler(nome)

    def save(self, nome: str, linhas: Linhas) -> None:
        if self._pendente is not None:
            self._pendente[nome] = copy.deepcopy(linhas)
        else:
            self._gravar({nome: linhas})

    @contextmanager
    def transacao(self) -> Iterator[None]:
        if self._pendente is not None:  # dentro de outra: vale como uma só
            yield
            return
        self._pendente = {}
        try:
            yield
            colecoes = self._pendente
        finally:
            self._pendente = None
        self._gravar(colecoes)


class JsonStore(_StoreComTransacao):
    """
    Um arquivo JSON por coleção. Transitório: some quando o banco entrar.

    A gravação não deixa arquivo pela metade: o conteúdo de TODAS as coleções é
    gerado antes de tocar o disco, cada uma é escrita num arquivo temporário da
    mesma pasta e só então os temporários trocam os definitivos. Se a
    serialização ou a escrita de qualquer uma falhar, nenhum arquivo definitivo
    muda.

    LIMITAÇÃO CONHECIDA: a troca dos arquivos é uma sequência de `os.replace`,
    cada uma atômica, mas o conjunto não é. Se o processo cair (ou o disco
    falhar) entre uma troca e a seguinte, uma coleção já terá o conteúdo novo e
    outra o antigo. A janela é de microssegundos e só existe no armazenamento
    em arquivo; o banco (PostgreSQL), que substitui este adaptador, a elimina.
    """

    def __init__(self, pasta: Union[Path, str]) -> None:
        super().__init__()
        self._pasta = Path(pasta)

    def _ler(self, nome: str) -> Linhas:
        caminho = self._pasta / f"{nome}.json"
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    def _gravar(self, colecoes: Dict[str, Linhas]) -> None:
        # 1) Prepara o conteúdo de todas antes de tocar o disco.
        conteudos = {nome: json.dumps(linhas, ensure_ascii=False, indent=2) for nome, linhas in colecoes.items()}
        if not conteudos:
            return
        pasta = self._pasta
        pasta.mkdir(parents=True, exist_ok=True)
        temporarios: Dict[str, str] = {}
        try:
            # 2) Escreve cada uma num temporário. Modo texto padrão, como o
            # `save_json` de antes: a quebra de linha é a do sistema (CRLF no
            # Windows), então os arquivos não mudam de formato.
            for nome, conteudo in conteudos.items():
                descritor, temporario = tempfile.mkstemp(dir=pasta, prefix=f".{nome}.", suffix=".tmp")
                temporarios[nome] = temporario
                with os.fdopen(descritor, "w", encoding="utf-8") as f:
                    f.write(conteudo)
            # 3) Só agora troca os arquivos (ver a limitação conhecida acima).
            for nome in list(temporarios):
                os.replace(temporarios[nome], pasta / f"{nome}.json")
                del temporarios[nome]
        finally:
            for temporario in temporarios.values():
                try:
                    os.unlink(temporario)
                except FileNotFoundError:
                    pass


class MemoriaStore(_StoreComTransacao):
    """Guarda as coleções só na memória. Para testes: não toca o disco."""

    def __init__(self) -> None:
        super().__init__()
        self._colecoes: Dict[str, Linhas] = {}

    def _ler(self, nome: str) -> Linhas:
        return copy.deepcopy(self._colecoes.get(nome, []))

    def _gravar(self, colecoes: Dict[str, Linhas]) -> None:
        for nome, linhas in colecoes.items():
            self._colecoes[nome] = copy.deepcopy(linhas)


# O store ativo. O padrão é o JsonStore na pasta de dados real. Quem precisa de
# outro, como um teste com `MemoriaStore`, troca com `usar_store`.
_ativo: Optional[Store] = None


def store_ativo() -> Store:
    """O store que o serviço de dados usa agora."""
    global _ativo
    if _ativo is None:
        _ativo = JsonStore(PASTA_DE_DADOS)
    return _ativo


def usar_store(store: Store) -> Store:
    """Troca o store ativo e devolve o que estava, para quem trocou restaurá-lo."""
    global _ativo
    anterior = store_ativo()
    _ativo = store
    return anterior
