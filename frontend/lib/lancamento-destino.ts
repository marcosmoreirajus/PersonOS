/**
 * Destino do lançamento manual (issue #26): Conta OU Cartão, nunca os dois.
 * Lançamento de conta pede a Conta (issue #22); compra no cartão pede o Cartão.
 */

export type Destino = 'conta' | 'cartao'

/** Frase de erro do campo, ou `undefined` se o destino escolhido está preenchido. */
export function erroDoDestino(destino: Destino, contaId: string, cartaoId: string): string | undefined {
  if (destino === 'cartao') return cartaoId ? undefined : 'Escolha o cartão da compra.'
  return contaId ? undefined : 'Escolha a conta do lançamento.'
}

/** O pedaço do corpo da API que identifica o destino: exatamente um dos dois campos. */
export function corpoDoDestino(destino: Destino, contaId: string, cartaoId: string): { account_id: number } | { card_id: number } {
  return destino === 'cartao' ? { card_id: Number(cartaoId) } : { account_id: Number(contaId) }
}

export type Repeticao = 'avista' | 'installment' | 'recurring'

/** Repetições que o destino aceita (issue #30): o Cartão não tem recorrência, só à vista e parcelado. */
export function repeticoesDoDestino(destino: Destino): Repeticao[] {
  return destino === 'cartao' ? ['avista', 'installment'] : ['avista', 'installment', 'recurring']
}

/** A repetição que vale depois de trocar o destino: a que o destino não aceita volta a à vista. */
export function repeticaoNoDestino(destino: Destino, atual: Repeticao): Repeticao {
  return repeticoesDoDestino(destino).includes(atual) ? atual : 'avista'
}

/** Cartão com que o formulário abre: o único do usuário (escolher entre um só é cerimônia), senão nenhum. */
export function cartaoInicial(cartoes: { id: number }[]): number | null {
  return cartoes.length === 1 ? cartoes[0].id : null
}
