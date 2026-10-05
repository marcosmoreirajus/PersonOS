/**
 * Fatura do cartão (issue #26): tipos da API e rótulos de apresentação.
 * A fatura é derivada no backend; aqui só se formata o que ele devolve.
 */

export type EstadoFatura = 'open' | 'closed'

export type Fatura = {
  card_id: number
  /** Mês de fechamento, `AAAA-MM`. */
  cycle: string
  closing_date: string
  due_date: string
  total: number
  state: EstadoFatura
  purchases_count: number
}

export type CompraDaFatura = {
  id: number
  description: string | null
  amount: number
  date: string
  category_id: number | null
}

export type FaturaDetalhe = Fatura & { purchases: CompraDaFatura[] }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** `2026-10` vira "Outubro de 2026"; texto fora do formato volta como veio. */
export function rotuloDoCiclo(ciclo: string): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ciclo)
  if (!m) return ciclo
  const mes = MESES[Number(m[2]) - 1]
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${m[1]}`
}

export function rotuloDoEstado(estado: EstadoFatura): string {
  return estado === 'open' ? 'Aberta' : 'Fechada'
}
