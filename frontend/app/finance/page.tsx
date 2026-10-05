'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, FileUp } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyValue } from '@/components/ui/money-value'
import { StatCard } from './_components/StatCard'
import { ProximosVencimentos } from './_components/ProximosVencimentos'
import { UltimasTransacoes } from './_components/UltimasTransacoes'
import { QuadroContas } from './_components/QuadroContas'
import {
  CategoryBreakdown,
  rankWithUncategorized,
  type BreakdownKind,
  type CategoryDatum,
} from './_components/CategoryBreakdown'
import { DailyHeatmap, type HeatmapTransaction, type PlannedOutflow } from './_components/DailyHeatmap'
import TransactionDialog from './transactions/_components/TransactionDialog'
import {
  effectiveStatus,
  toScheduledItems,
  type ScheduledItem,
  type Series,
} from './agendadas/_components/types'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { categoryColorByRank, incomeColorByRank } from '@/lib/category-colors'

type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  /** Quando vence / quando era esperado. */
  due_date: string
  /** Nulo até o dinheiro se mover — é o que separa realizado de previsto. */
  settled_at: string | null
  series_id: number | null
  series_index: number | null
  card_invoice?: boolean
  /** Nulo = "Sem categoria" (balde virtual, nunca "Outros"). */
  category_id: number | null
  /** Dinheiro trocando de bolso: fora de toda soma. */
  is_internal_transfer?: boolean
}

type Category = {
  id: number
  name: string
  icon: string
  color: string
  type: 'expense' | 'income' | 'both'
}

/** O que a tela usa do resumo da Visão Geral: o Saldo vem da API, não é refeito aqui. */
type DashboardSummary = {
  accounts_balance: { total: number }
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export default function FinanceDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([])
  const [saldo, setSaldo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)
  const [breakdownKind, setBreakdownKind] = useState<BreakdownKind>('expense')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKind, setDialogKind] = useState<'expense' | 'income' | 'transfer'>('expense')
  // O cadastro de lançamento vive aqui na Visão Geral: os botões rápidos de
  // Despesas/Entradas/Transferência só escolhem o tipo — o resto é o mesmo dialog
  // das Transações, já apontado para o mês aberto.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [tx, cats, series, resumo] = await Promise.all([
          api<Transaction[]>(`/api/transactions/user/${CURRENT_USER_ID}`),
          api<Category[]>('/api/categories'),
          api<Series[]>(`/api/series/user/${CURRENT_USER_ID}`),
          api<DashboardSummary>(`/api/dashboard/${CURRENT_USER_ID}`),
        ])
        if (!cancelled) {
          setSaldo(resumo.accounts_balance.total)
          // Saldo, cards e relatórios só olham o efetivado; o previsto existe
          // na mesma base desde a fonte única, mas não soma.
          setTransactions(
            [...tx]
              .filter((t) => t.settled_at)
              .sort((a, b) => new Date(a.settled_at!).getTime() - new Date(b.settled_at!).getTime())
          )
          setCategories(cats)
          setScheduled(toScheduledItems(tx, series))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const computed = useMemo(() => {
    // Transferência interna fica fora de cards, saldo, gráficos e mapa de
    // calor (spec); continua só em "Últimas transações", que é lista.
    const somaveis = transactions.filter((t) => !t.is_internal_transfer)
    const incomeTx = somaveis.filter((t) => t.type === 'income')
    const expenseTx = somaveis.filter((t) => t.type === 'expense')
    const income = incomeTx.reduce((s, t) => s + t.amount, 0)
    const expense = expenseTx.reduce((s, t) => s + t.amount, 0)
    const balance = income - expense

    function cumulative(list: Transaction[], sign: 1 | -1) {
      let running = 0
      return list.map((t) => {
        running += sign * t.amount
        return running
      })
    }

    const netByDay = new Map<string, number>()
    for (const t of somaveis) {
      const key = dayKey(t.settled_at!)
      const delta = t.type === 'income' ? t.amount : -t.amount
      netByDay.set(key, (netByDay.get(key) ?? 0) + delta)
    }
    const days = [...netByDay.keys()].sort()
    const resultPoints: { date: string; cumulative: number }[] = []
    let running = 0
    for (const date of days) {
      running += netByDay.get(date) ?? 0
      resultPoints.push({ date, cumulative: running })
    }

    const transactionsByDay = new Map<string, HeatmapTransaction[]>()
    for (const t of somaveis) {
      const key = dayKey(t.settled_at!)
      const cat = categories.find((c) => c.id === t.category_id)
      const entry: HeatmapTransaction = {
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        categoryName: cat?.name,
      }
      transactionsByDay.set(key, [...(transactionsByDay.get(key) ?? []), entry])
    }

    function byCategory(list: Transaction[], colorByRank: (rank: number) => string): CategoryDatum[] {
      const totals = new Map<number, number>()
      let semCategoria = 0
      for (const t of list) {
        if (t.category_id == null) semCategoria += t.amount
        else totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
      }
      const real = [...totals.entries()].map(([catId, value]) => ({
        name: categories.find((c) => c.id === catId)?.name ?? 'Categoria removida',
        value,
      }))
      return rankWithUncategorized(real, semCategoria, colorByRank)
    }
    const categoryData = byCategory(expenseTx, categoryColorByRank)
    const incomeCategoryData = byCategory(incomeTx, incomeColorByRank)

    // "Maior categoria" é sempre uma categoria de verdade; o balde tem o
    // próprio destaque no gráfico.
    const topCategory = categoryData.find((d) => !d.href)
    const biggestExpense = expenseTx.reduce((max, t) => (t.amount > (max?.amount ?? 0) ? t : max), null as Transaction | null)
    const biggestIncome = incomeTx.reduce((max, t) => (t.amount > (max?.amount ?? 0) ? t : max), null as Transaction | null)

    return {
      income,
      expense,
      balance,
      incomeCount: incomeTx.length,
      expenseCount: expenseTx.length,
      totalCount: transactions.length,
      saldoSparkline: resultPoints.map((p) => p.cumulative),
      entradasSparkline: cumulative(incomeTx, 1),
      saidasSparkline: cumulative(expenseTx, 1),
      resultPoints,
      transactionsByDay,
      categoryData,
      incomeCategoryData,
      topCategory,
      biggestExpense,
      biggestIncome,
    }
  }, [transactions, categories])

  // Saídas agendadas ainda não pagas → "previstas" no calendário de saídas.
  const plannedByDay = useMemo(() => {
    const today = new Date()
    const map = new Map<string, PlannedOutflow[]>()
    for (const item of scheduled) {
      if (item.type !== 'expense' || item.status === 'paid') continue
      const entry: PlannedOutflow = {
        id: item.id,
        name: item.name,
        amount: item.value,
        isInvoice: Boolean(item.card_invoice),
        overdue: effectiveStatus(item, today) === 'overdue',
      }
      map.set(item.due_date, [...(map.get(item.due_date) ?? []), entry])
    }
    return map
  }, [scheduled])

  if (loading) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const topCategoryPct =
    computed.topCategory && computed.expense > 0 ? (computed.topCategory.value / computed.expense) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Visão geral</h1>
        <MonthPicker value={month} onChange={setMonth} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogKind('expense')
              setDialogOpen(true)
            }}
          >
            <ArrowDownToLine className="size-4" />
            Despesas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogKind('income')
              setDialogOpen(true)
            }}
          >
            <ArrowUpFromLine className="size-4" />
            Entradas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogKind('transfer')
              setDialogOpen(true)
            }}
          >
            <ArrowLeftRight className="size-4" />
            Transferência
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/finance/importar" />} nativeButton={false}>
            <FileUp className="size-4" />
            Importar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo"
          sentence={
            <>
              Você tem <MoneyValue value={saldo} className="font-bold" /> de saldo, somando as contas e os{' '}
              {computed.totalCount} lançamento{computed.totalCount === 1 ? '' : 's'} registrado
              {computed.totalCount === 1 ? '' : 's'}.
            </>
          }
          secondaryValue={`${computed.totalCount} lançamentos`}
          secondaryDesc="no total registrado"
          sparklinePoints={computed.saldoSparkline}
          facts={[
            { label: 'Maior entrada', value: computed.biggestIncome ? <MoneyValue value={computed.biggestIncome.amount} /> : '—' },
            { label: 'Maior saída', value: computed.biggestExpense ? <MoneyValue value={computed.biggestExpense.amount} /> : '—' },
          ]}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        />

        <StatCard
          label="Entradas"
          sentence={
            <>
              Entraram <MoneyValue value={computed.income} className="font-bold" /> em {computed.incomeCount}{' '}
              lançamento{computed.incomeCount === 1 ? '' : 's'}.
            </>
          }
          secondaryValue={`${computed.incomeCount} lançamento${computed.incomeCount === 1 ? '' : 's'}`}
          secondaryDesc="de entrada"
          sparklinePoints={computed.entradasSparkline}
          facts={[
            { label: 'Maior entrada', value: computed.biggestIncome ? <MoneyValue value={computed.biggestIncome.amount} /> : '—' },
            { label: 'Lançamentos', value: computed.incomeCount },
          ]}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        />

        <StatCard
          label="Saídas"
          sentence={
            <>
              Saíram <MoneyValue value={computed.expense} className="font-bold" /> em {computed.expenseCount}{' '}
              lançamento{computed.expenseCount === 1 ? '' : 's'}
              {computed.topCategory ? `, ${topCategoryPct.toFixed(0)}% só em ${computed.topCategory.name}` : ''}.
            </>
          }
          secondaryValue={computed.topCategory ? `${topCategoryPct.toFixed(0)}%` : '—'}
          secondaryDesc={computed.topCategory ? `maior categoria: ${computed.topCategory.name}` : 'sem despesas'}
          sparklinePoints={computed.saidasSparkline}
          facts={[
            { label: 'Lançamentos', value: computed.expenseCount },
            { label: 'Maior saída', value: computed.biggestExpense ? <MoneyValue value={computed.biggestExpense.amount} /> : '—' },
          ]}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        />

        <StatCard
          label="Resultado"
          sentence={
            <>
              Fechou <MoneyValue value={computed.balance} className="font-bold" /> no{' '}
              {computed.balance >= 0 ? 'positivo' : 'negativo'} neste período.
            </>
          }
          secondaryValue={computed.balance >= 0 ? 'Positivo' : 'Negativo'}
          secondaryDesc="resultado do período"
          sparklinePoints={computed.saldoSparkline}
          facts={[
            { label: 'Entradas', value: <MoneyValue value={computed.income} /> },
            { label: 'Saídas', value: <MoneyValue value={computed.expense} /> },
          ]}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        />
      </div>

      {/* Posição provisória: o layout final é o ticket #23. */}
      <ProximosVencimentos refreshKey={refreshKey} />
      <QuadroContas onChange={() => setRefreshKey((k) => k + 1)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Saídas por dia</CardTitle>
            <CardDescription>Quanto saiu em cada dia do mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyHeatmap transactionsByDay={computed.transactionsByDay} plannedByDay={plannedByDay} month={month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{breakdownKind === 'expense' ? 'Onde o dinheiro saiu' : 'De onde o dinheiro veio'}</CardTitle>
                <CardDescription>{breakdownKind === 'expense' ? 'Despesas' : 'Receitas'} por categoria</CardDescription>
              </div>
              <Link href="/finance/transactions" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
                Ver transações ›
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              data={breakdownKind === 'expense' ? computed.categoryData : computed.incomeCategoryData}
              kind={breakdownKind}
              onKindChange={setBreakdownKind}
            />
          </CardContent>
        </Card>
      </div>

      <UltimasTransacoes
        refreshKey={refreshKey}
        onNovo={() => {
          setDialogKind('expense')
          setDialogOpen(true)
        }}
      />

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        userId={CURRENT_USER_ID}
        onSaved={() => setRefreshKey((k) => k + 1)}
        initialType={dialogKind === 'transfer' ? undefined : dialogKind}
      />
    </div>
  )
}
