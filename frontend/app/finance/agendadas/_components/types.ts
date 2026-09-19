import { Banknote, Layers, RefreshCw, type LucideIcon } from 'lucide-react'

import { categoryColorByRank } from '@/lib/category-colors'

export type ScheduledStatus = 'pending' | 'paid' | 'overdue'
/** Forma de recorrência do lançamento — eixo distinto da categoria do gasto. */
export type ScheduledNature = 'recorrente' | 'a_vista' | 'parcelado'
export type ScheduledFrequency = 'semanal' | 'quinzenal' | 'mensal'

export type ScheduledItem = {
  id: number
  name: string
  /** Conta a pagar (`expense`) ou receita a receber (`income`) — mesmo eixo de `transactions.json`. */
  type: 'income' | 'expense'
  category_id: number
  nature: ScheduledNature
  /** Só quando `nature === 'recorrente'`. */
  frequency?: ScheduledFrequency
  /** Só quando `nature === 'parcelado'`. */
  installment?: { current: number; total: number }
  value: number
  due_date: string
  status: 'pending' | 'paid'
}

export type Category = {
  id: number
  name: string
}

/** Mesmas categorias da Visão Geral e de Transações (`/api/categories`). */
export type CategoryMeta = { name: string; color: string }

/**
 * Cor por ranking de valor no mês (mesma regra da Visão Geral: âmbar = maior
 * gasto). Calculada sobre o mês inteiro, antes dos filtros, pra cor não mudar
 * ao filtrar. Só despesas entram no ranking — categoria de receita fica neutra.
 */
export function buildCategoryMeta(items: ScheduledItem[], categories: Category[]): Map<number, CategoryMeta> {
  const totals = new Map<number, number>()
  for (const item of items) {
    if (item.type === 'expense') totals.set(item.category_id, (totals.get(item.category_id) ?? 0) + item.value)
  }

  const meta = new Map<number, CategoryMeta>()
  ;[...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([id], rank) => {
      const name = categories.find((c) => c.id === id)?.name ?? 'Outros'
      meta.set(id, { name, color: categoryColorByRank(rank) })
    })
  for (const item of items) {
    if (!meta.has(item.category_id)) {
      const name = categories.find((c) => c.id === item.category_id)?.name ?? 'Outros'
      meta.set(item.category_id, { name, color: categoryColorByRank(Infinity) })
    }
  }
  return meta
}

export type PendingSummary = {
  toPay: { count: number; total: number }
  toReceive: { count: number; total: number }
  overdueCount: number
}

export function isInMonth(item: ScheduledItem, month: Date): boolean {
  const due = new Date(`${item.due_date}T00:00:00`)
  return due.getFullYear() === month.getFullYear() && due.getMonth() === month.getMonth()
}

/** Tudo que não foi pago/recebido nos itens recebidos (a vencer + em atraso). */
export function pendingSummary(items: ScheduledItem[], today: Date): PendingSummary {
  const summary: PendingSummary = { toPay: { count: 0, total: 0 }, toReceive: { count: 0, total: 0 }, overdueCount: 0 }
  for (const item of items) {
    if (item.status === 'paid') continue
    if (effectiveStatus(item, today) === 'overdue') summary.overdueCount += 1
    const bucket = item.type === 'income' ? summary.toReceive : summary.toPay
    bucket.count += 1
    bucket.total += item.value
  }
  return summary
}

export const NATURE_LABEL: Record<ScheduledNature, string> = {
  recorrente: 'Recorrente',
  a_vista: 'À vista',
  parcelado: 'Parcelado',
}

const FREQUENCY_LABEL: Record<ScheduledFrequency, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

/** Rótulo + ícone do badge de Natureza (ex.: "Mensal", "À vista", "Parcela 3/5"). */
export function natureMeta(item: ScheduledItem): { label: string; icon: LucideIcon } {
  switch (item.nature) {
    case 'recorrente':
      return { label: item.frequency ? FREQUENCY_LABEL[item.frequency] : 'Recorrente', icon: RefreshCw }
    case 'parcelado':
      return {
        label: item.installment ? `Parcela ${item.installment.current}/${item.installment.total}` : 'Parcelado',
        icon: Layers,
      }
    case 'a_vista':
      return { label: 'À vista', icon: Banknote }
  }
}

/** Deriva o status efetivo (paid/pending/overdue) comparando due_date com hoje. */
export function effectiveStatus(item: ScheduledItem, today: Date): ScheduledStatus {
  if (item.status === 'paid') return 'paid'
  const due = new Date(`${item.due_date}T00:00:00`)
  return due < today ? 'overdue' : 'pending'
}
