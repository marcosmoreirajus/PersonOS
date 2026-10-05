# -*- coding: utf-8 -*-
"""
Apoio dos scripts de aceite que dependem dos dados de exemplo (backend/data).

`store_com_dados_de_exemplo()` LÊ os arquivos `*.json` da pasta de dados (somente
leitura, nunca grava) e devolve um `MemoriaStore` semeado com eles. Os scripts
instalam esse store com `usar_store`: nada vai ao disco e a pasta de dados real
não é tocada.
"""

import json
from typing import Iterable

from app.services.store import PASTA_DE_DADOS, MemoriaStore


def store_com_dados_de_exemplo(sem: Iterable[str] = ()) -> MemoriaStore:
    """Um MemoriaStore com as coleções de backend/data. `sem` lista coleções a deixar vazias."""
    ignoradas = set(sem)
    store = MemoriaStore()
    for arquivo in sorted(PASTA_DE_DADOS.glob("*.json")):
        if arquivo.stem in ignoradas:
            continue
        with open(arquivo, "r", encoding="utf-8") as f:
            store.save(arquivo.stem, json.load(f))
    return store
