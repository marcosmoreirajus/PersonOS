"""
Store: o limite entre a regra de negócio e o armazenamento (ADR 0001).

A interface é de **coleção inteira** de propósito: `load(nome)` devolve todas as
linhas e `save(nome, linhas)` as substitui. Operações por entidade (`add`,
`update`, `delete`) ficam para quando o banco entrar; desenhá-las agora seria
modelar para um adaptador que ainda não existe.

Contrato que todo adaptador cumpre:
- coleção ausente devolve lista vazia;
- o que `load` devolve e o que `save` recebe são cópias independentes: alterar
  uma lista sem gravar não muda o store.
"""

import copy
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Protocol, Union

Linhas = List[Dict[str, Any]]

# A pasta dos dados reais. Fica aqui, num lugar só: o serviço de dados a usa para
# o seu `DATA_DIR` e o store padrão aponta para ela.
PASTA_DE_DADOS = Path(__file__).parent.parent.parent / "data"


class Store(Protocol):
    """A interface que todo adaptador cumpre (hoje JSON e memória; o banco será o terceiro)."""

    def load(self, nome: str) -> Linhas: ...

    def save(self, nome: str, linhas: Linhas) -> None: ...


class JsonStore:
    """
    Um arquivo JSON por coleção. Transitório: some quando o banco entrar.

    `pasta` pode ser um caminho ou uma função que devolve o caminho, resolvida a
    cada uso (o serviço de dados ainda aponta para a pasta por uma variável que
    os scripts de aceite trocam; isso sai quando eles migrarem para o
    `MemoriaStore`).

    A gravação não deixa arquivo pela metade: o conteúdo é gerado antes de
    tocar o disco, escrito num arquivo temporário da mesma pasta e só então
    trocado pelo definitivo. Se a serialização ou a escrita falhar, o arquivo
    anterior continua como estava.
    """

    def __init__(self, pasta: Union[Path, str, Callable[[], Union[Path, str]]]) -> None:
        self._pasta = pasta

    def _dir(self) -> Path:
        return Path(self._pasta() if callable(self._pasta) else self._pasta)

    def load(self, nome: str) -> Linhas:
        caminho = self._dir() / f"{nome}.json"
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    def save(self, nome: str, linhas: Linhas) -> None:
        conteudo = json.dumps(linhas, ensure_ascii=False, indent=2)
        pasta = self._dir()
        pasta.mkdir(parents=True, exist_ok=True)
        descritor, temporario = tempfile.mkstemp(dir=pasta, prefix=f".{nome}.", suffix=".tmp")
        try:
            # Modo texto padrão, como o `save_json` de antes: a quebra de linha é a
            # do sistema (CRLF no Windows), então os arquivos não mudam de formato.
            with os.fdopen(descritor, "w", encoding="utf-8") as f:
                f.write(conteudo)
            os.replace(temporario, pasta / f"{nome}.json")
        except BaseException:
            try:
                os.unlink(temporario)
            except FileNotFoundError:
                pass
            raise


class MemoriaStore:
    """Guarda as coleções só na memória. Para testes: não toca o disco."""

    def __init__(self) -> None:
        self._colecoes: Dict[str, Linhas] = {}

    def load(self, nome: str) -> Linhas:
        return copy.deepcopy(self._colecoes.get(nome, []))

    def save(self, nome: str, linhas: Linhas) -> None:
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
