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

/** Cartão com que o formulário abre: o único do usuário (escolher entre um só é cerimônia), senão nenhum. */
export function cartaoInicial(cartoes: { id: number }[]): number | null {
  return cartoes.length === 1 ? cartoes[0].id : null
}
