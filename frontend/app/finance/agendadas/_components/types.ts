import { Banknote, CreditCard, Layers, RefreshCw, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

import { categoryColorByRank } from '@/lib/category-colors'

/**
 * `ScheduledItem` deixou de ser uma entidade própria: desde a Fatia 1 do modelo
 * de entrada de dados, o registro mora em `transactions.json` e Agendadas é uma
 * VISÃO dele. O tipo continua existindo como view model da tela (é o que o
 * calendário, a lista e os filtros consomem), montado por `toScheduledItems`.
 */
export type ScheduledStatus = 'pending' | 'paid' | 'overdue'
/** Forma de recorrência do lançamento — eixo distinto da categoria do gasto. */
export type ScheduledNature = 'recorrente' | 'a_vista' | 'parcelado'
export type ScheduledFrequency = 'semanal' | 'quinzenal' | 'mensal'

export type ScheduledItem = {
  id: number
  /**
   * Ocorrência **calculada**, não gravada — além do horizonte de geração.
   * Aparece no calendário e nos totais do mês, mas não pode ser paga nem
   * editada: ela ainda não existe como registro.
   */
  projected?: boolean
  name: string
  /** Conta a pagar (`expense`) ou receita a receber (`income`) — mesmo eixo de `transactions.json`. */
  type: 'income' | 'expense'
  /**
   * Fatura de cartão de crédito (sempre `expense`). Por ora só marca o item
   * pra legenda do calendário — o módulo de cartões/faturas segue adiado.
   */
  card_invoice?: boolean
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

/** Ocorrência projetada, como vem de `/api/series/projection`. */
export type ProjectedOccurrence = {
  series_id: number
  series_index: number | null
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  due_date: string
}

/**
 * Converte projeções em itens da tela.
 *
 * Recebem id negativo derivado da série e da data: precisam de chave estável
 * pro React, e um id positivo se confundiria com registro de verdade.
 */
export function projectedToScheduledItems(
  projecoes: ProjectedOccurrence[],
  series: Series[]
): ScheduledItem[] {
  const byId = new Map(series.map((s) => [s.id, s]))
  return projecoes.map((p, i) => {
    const s = byId.get(p.series_id)
    const nature: ScheduledNature = !s ? 'a_vista' : s.kind === 'installment' ? 'parcelado' : 'recorrente'
    return {
      id: -(i + 1),
      projected: true,
      name: p.description ?? 'Sem descrição',
      type: p.type,
      category_id: p.category_id ?? -1,
      nature,
      frequency: s && s.kind === 'recurring' ? FREQUENCY_FROM_API[s.frequency] : undefined,
      installment:
        s && s.kind === 'installment' && p.series_index != null && s.total_count != null
          ? { current: p.series_index, total: s.total_count }
          : undefined,
      value: p.amount,
      due_date: p.due_date,
      status: 'pending' as const,
    }
  })
}

/** Transação como vem de `/api/transactions` depois da Fatia 1. */
export type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  due_date: string
  /** Nulo enquanto o dinheiro não se moveu. Só daqui sai "realizado". */
  settled_at: string | null
  series_id: number | null
  series_index: number | null
  card_invoice?: boolean
}

/** Série como vem de `/api/series`. */
export type Series = {
  id: number
  kind: 'installment' | 'recurring'
  frequency: 'monthly' | 'biweekly' | 'weekly'
  total_count: number | null
}

const FREQUENCY_FROM_API: Record<Series['frequency'], ScheduledFrequency> = {
  monthly: 'mensal',
  biweekly: 'quinzenal',
  weekly: 'semanal',
}

/**
 * Monta a visão de Agendadas a partir de transações + séries.
 *
 * A natureza (à vista / recorrente / parcelado) não é mais um campo do
 * lançamento: ela é uma leitura do vínculo com a série. E `status` deriva de
 * `settled_at`, nunca de um campo gravado — conta vencida e não paga não é
 * "realizada", é atrasada, e isso quem decide é `effectiveStatus`.
 */
export function toScheduledItems(transactions: Transaction[], series: Series[]): ScheduledItem[] {
  const byId = new Map(series.map((s) => [s.id, s]))

  return transactions.map((t) => {
    const s = t.series_id != null ? byId.get(t.series_id) : undefined
    const nature: ScheduledNature = !s ? 'a_vista' : s.kind === 'installment' ? 'parcelado' : 'recorrente'

    return {
      id: t.id,
      name: t.description ?? 'Sem descrição',
      type: t.type,
      card_invoice: t.card_invoice,
      // Categoria nula é o balde virtual "Sem categoria"; aqui ele cai no
      // neutro do `buildCategoryMeta`, sem virar uma categoria de verdade.
      category_id: t.category_id ?? -1,
      nature,
      frequency: s && s.kind === 'recurring' ? FREQUENCY_FROM_API[s.frequency] : undefined,
      installment:
        s && s.kind === 'installment' && t.series_index != null && s.total_count != null
          ? { current: t.series_index, total: s.total_count }
          : undefined,
      value: t.amount,
      due_date: t.due_date,
      status: t.settled_at ? 'paid' : 'pending',
    }
  })
}

/** Como o item aparece no calendário/legenda. */
export type ScheduledKind = 'receita' | 'despesa' | 'fatura'

export function scheduledKind(item: ScheduledItem): ScheduledKind {
  if (item.type === 'income') return 'receita'
  return item.card_invoice ? 'fatura' : 'despesa'
}

export const KIND_META: Record<ScheduledKind, { label: string; icon: LucideIcon; className: string }> = {
  receita: { label: 'Receita', icon: TrendingUp, className: 'text-sage' },
  despesa: { label: 'Despesa', icon: TrendingDown, className: 'text-terracotta' },
  fatura: { label: 'Fatura do cartão', icon: CreditCard, className: 'text-dusty-blue' },
}

/** Valor com sinal: receita soma, despesa/fatura subtrai. */
export function signedValue(item: ScheduledItem): number {
  return item.type === 'income' ? item.value : -item.value
}

export type MonthForecast = {
  income: { total: number; done: number }
  expense: { total: number; done: number; invoices: number }
  balance: number
}

/** Previsibilidade do mês: tudo que entra e sai, quanto já foi quitado e o saldo previsto. */
export function monthForecast(items: ScheduledItem[]): MonthForecast {
  const f: MonthForecast = { income: { total: 0, done: 0 }, expense: { total: 0, done: 0, invoices: 0 }, balance: 0 }
  for (const item of items) {
    const bucket = item.type === 'income' ? f.income : f.expense
    bucket.total += item.value
    if (item.status === 'paid') bucket.done += item.value
    if (item.card_invoice) f.expense.invoices += item.value
  }
  f.balance = f.income.total - f.expense.total
  return f
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
  // Compara com o início do dia: o que vence HOJE ainda está "a vencer", não em atraso.
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return due < todayStart ? 'overdue' : 'pending'
}
