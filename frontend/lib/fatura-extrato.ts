/**
 * Fatura corrigida pelo extrato (issue #28): campos extras que a fatura ganha
 * e o item de diferença de total em "A revisar". Só apresentação; a regra é
 * do backend.
 */

export type ExtratoDaFatura = {
  /** Total que o extrato (ou o usuário) declarou; null = sem total declarado. */
  declared_total: number | null
  /** Declarado menos a soma das compras; null sem total declarado. */
  difference: number | null
  total_decision: 'extract' | 'purchases' | null
  /** Soma das compras do ciclo, mesmo quando o total adotado é o do extrato. */
  purchases_total: number
  /** Campos corrigidos (`closing_date`, `due_date`, `declared_total`). */
  corrected: string[]
}

export type DiferencaDeFatura = {
  card_id: number
  card_name: string
  cycle: string
  due_date: string
  declared_total: number
  purchases_total: number
  difference: number
  /** De onde veio o total: lido do arquivo ou informado à mão. */
  source: 'file' | 'manual' | null
}

/** Causas prováveis, sem valores (os valores vão em MoneyValue, que respeita a privacidade). */
export function explicarDiferenca(diferenca: number): string {
  return diferenca > 0
    ? 'O extrato cobra mais do que as compras importadas: pode ser compra faltando, juros ou erro.'
    : 'O extrato cobra menos do que as compras importadas: pode ser compra duplicada, estorno ou erro.'
}

/** Texto de um campo numérico: vazio apaga (null); número inválido ou negativo também é null com `valido: false`. */
export function lerTotalDigitado(texto: string): { valor: number | null; valido: boolean } {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return { valor: null, valido: true }
  const n = Number(limpo)
  if (!Number.isFinite(n) || n < 0) return { valor: null, valido: false }
  return { valor: Math.round(n * 100) / 100, valido: true }
}
