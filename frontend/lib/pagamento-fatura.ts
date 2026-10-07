/**
 * Pagamento da fatura (issue #29): tipos da API e a escolha da fatura.
 * Quem sugere e decide é o backend; aqui só se escolhe e se rotula.
 */

import { rotuloDoCiclo } from './faturas.ts'

export type OpcaoFatura = {
  card_id: number
  card_name: string
  /** Mês de fechamento, `AAAA-MM`. */
  cycle: string
  closing_date: string
  due_date: string
  total: number
  remaining: number
  state: 'closed' | 'partially_paid'
  /** A regra de suspeita aponta esta fatura (valor igual ao total/restante, ou marcador na descrição). */
  sugerida: boolean
}

export type OpcoesDePagamento = {
  /** Mais antiga primeiro. */
  opcoes: OpcaoFatura[]
  /** A sugerida mais antiga; sem sugerida, a mais antiga de todas; nenhuma fatura a pagar, nulo. */
  padrao: { card_id: number; cycle: string } | null
}

/** O valor do seletor carrega o cartão e o ciclo juntos: `3|2026-08`. */
export function chaveDaFatura(f: { card_id: number; cycle: string }): string {
  return `${f.card_id}|${f.cycle}`
}

export function lerChave(chave: string): { card_id: number; cycle: string } | null {
  const [cartao, ciclo] = chave.split('|')
  const card_id = Number(cartao)
  return Number.isInteger(card_id) && card_id > 0 && ciclo ? { card_id, cycle: ciclo } : null
}

/** "Nubank · Agosto de 2026" — o valor restante vai ao lado, em MoneyValue (respeita a privacidade). */
export function rotuloDaOpcao(o: Pick<OpcaoFatura, 'card_name' | 'cycle'>): string {
  return `${o.card_name} · ${rotuloDoCiclo(o.cycle)}`
}
