"""
Coleção fechada de logos de conta. O app não aceita imagem enviada pelo
usuário: a conta guarda o texto de um item desta coleção.

Dois formatos:
  catalogo:<chave>        instituição financeira (INSTITUICOES) ou bandeira de cartão (BANDEIRAS)
  icone:<icone>:<cor>     ícone personalizado (ICONES) sobre uma cor da paleta (CORES, hex sem #)

O visual (cor da marca, sigla, ícone) mora no frontend, em
`frontend/lib/conta-logos.ts`; `frontend/lib/conta-logos.test.ts` confere que
as quatro listas têm os mesmos itens. Item novo: acrescentar aqui e lá.
"""

PREFIXO = "catalogo:"
PREFIXO_ICONE = "icone:"

INSTITUICOES = frozenset(
    {
        "nubank",
        "itau",
        "bradesco",
        "santander",
        "banco-do-brasil",
        "caixa",
        "c6",
        "inter",
        "btg",
        "xp",
        "mercado-pago",
        "picpay",
        "sicredi",
        "sicoob",
        "neon",
        "will",
        "pagbank",
        "original",
        "safra",
        "next",
        "banrisul",
        "stone",
    }
)

BANDEIRAS = frozenset({"visa", "mastercard", "elo", "amex", "hipercard", "diners"})

ICONES = frozenset({"banco", "carteira", "cofrinho", "cartao"})

CORES = frozenset(
    {
        "f1f3f2",
        "d6d6d6",
        "ffe600",
        "ff0000",
        "0066ff",
        "00e664",
        "ffd8b0",
        "ffbf70",
        "ffa02e",
        "e87500",
        "ff9eb0",
        "ff6b81",
        "ff3350",
        "cc001f",
        "ff8f7d",
        "ff5a3c",
        "b8e986",
        "7ed321",
        "5cb000",
        "417505",
        "8fffe0",
        "4df2cc",
        "10d9ac",
        "00b08a",
        "9fd8ff",
        "4aa8ff",
        "1f5fbf",
        "0a2a66",
        "d5b8ff",
        "a066ff",
        "7a28e0",
        "4b1587",
        "8b5a2b",
        "333333",
    }
)


def logo_valido(valor: str) -> bool:
    if valor.startswith(PREFIXO):
        chave = valor[len(PREFIXO):]
        return chave in INSTITUICOES or chave in BANDEIRAS
    if valor.startswith(PREFIXO_ICONE):
        partes = valor[len(PREFIXO_ICONE):].split(":")
        return len(partes) == 2 and partes[0] in ICONES and partes[1] in CORES
    return False
