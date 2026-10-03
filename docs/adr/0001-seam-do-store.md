---
status: accepted
---

# O acesso aos dados passa por um store de coleções, com `transacao()` atômica

O `DataService` lia e gravava `backend/data/*.json` direto, e os testes isolavam isso com `copytree` e monkeypatch de `DATA_DIR`. Decidimos um seam entre o `DataService` e o armazenamento: um store com `load(nome)`, `save(nome, linhas)` e `transacao()`, que grava várias coleções de uma vez, tudo ou nada (hoje `transactions` e `series` ou `accounts` são gravadas em separado, e uma queda no meio deixa os arquivos incoerentes). Os adaptadores são o `JsonStore` e o `MemoriaStore` (teste), e o PostgreSQL entra depois como terceiro. O store ativo é trocado por módulo, com `usar_store(...)`, e os `@staticmethod` do `DataService` continuam como estão.

A interface é de **coleção inteira**, não de entidade, de propósito: operações por entidade (`add`, `update`, `delete`) são o trabalho de cortar o `data_service.py` pelos domínios, e desenhá-las agora seria modelar para um adaptador de banco que ainda não existe. Quando o banco entrar, a interface passa a ser por entidade, e o `JsonStore` some. Os dados atuais são fictícios e as finanças entram do zero no banco, então não há migração JSON → banco.

## Considered Options

- **Injeção explícita (`DataService(store)`)**: muda as 53 chamadas, as rotas e o `series_engine`, um refactor maior que o seam.
- **Só `load`/`save`, sem `transacao()`**: mantém a escrita em duas coleções sem atomicidade.
- **Ir direto ao banco**: juntaria modelo, adaptador e teste num passo só, sem rede de segurança.
- **Operações por entidade já agora**: ver o parágrafo acima.

## Consequences

- A geração de id (`max(id) + 1`) continua dentro das funções do `DataService`. Passa para trás do seam quando a interface virar por entidade, junto com o banco.
- O Módulo Negócio (`business_service`, Markdown) fica fora do store.
- Os `testa_*.py` passam a usar `MemoriaStore` em vez de `copytree`, e viram a rede de segurança do adaptador de banco.
