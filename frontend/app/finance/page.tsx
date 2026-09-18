'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { MonthPicker } from '@/components/ui/month-picker'
import { MoneyValue } from '@/components/ui/money-value'
import { StatCard } from './_components/StatCard'
import { CategoryBreakdown, type CategoryDatum } from './_components/CategoryBreakdown'
import { ResultChart } from './_components/ResultChart'
import { categoryColorByRank } from '@/lib/category-colors'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  transaction_date: string
  category_id: number
}

type Category = {
  id: number
  name: string
  icon: string
  color: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export default function FinanceDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => new Date())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [txRes, catRes] = await Promise.all([
          fetch(`${API_URL}/api/transactions/user/${CURRENT_USER_ID}`),
          fetch(`${API_URL}/api/categories`),
        ])
        const txJson = await txRes.json()
        const catJson = await catRes.json()
        if (!cancelled) {
          setTransactions(
            [...(txJson.data || [])].sort(
              (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
            )
          )
          setCategories(catJson.data || [])
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar o dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const computed = useMemo(() => {
    const incomeTx = transactions.filter((t) => t.type === 'income')
    const expenseTx = transactions.filter((t) => t.type === 'expense')
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
    for (const t of transactions) {
      const key = dayKey(t.transaction_date)
      const delta = t.type === 'income' ? t.amount : -t.amount
      netByDay.set(key, (netByDay.get(key) ?? 0) + delta)
    }
    const days = [...netByDay.keys()].sort()
    let running = 0
    const resultPoints = days.map((date) => {
      running += netByDay.get(date) ?? 0
      return { date, cumulative: running }
    })

    const categoryTotals = new Map<number, number>()
    for (const t of expenseTx) {
      categoryTotals.set(t.category_id, (categoryTotals.get(t.category_id) ?? 0) + t.amount)
    }
    const categoryData: CategoryDatum[] = [...categoryTotals.entries()]
      .map(([catId, value]) => {
        const cat = categories.find((c) => c.id === catId)
        return { name: cat?.name ?? 'Outros', value }
      })
      .sort((a, b) => b.value - a.value)
      .map((d, rank) => ({ ...d, color: categoryColorByRank(rank) }))

    const topCategory = categoryData[0]
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
      categoryData,
      topCategory,
      biggestExpense,
      biggestIncome,
    }
  }, [transactions, categories])

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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo"
          sentence={
            <>
              Você tem <MoneyValue value={computed.balance} className="font-bold" /> de saldo, somando{' '}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resultado do mês</CardTitle>
            <CardDescription>Saldo acumulado ao longo das transações registradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResultChart points={computed.resultPoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Onde o dinheiro saiu</CardTitle>
                <CardDescription>Despesas por categoria</CardDescription>
              </div>
              <Link href="/finance/relatorios" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
                Ver despesas ›
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={computed.categoryData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...transactions]
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                .slice(0, 5)
                .map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-foreground">{t.description || 'Sem descrição'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(t.transaction_date)}</span>
                    </div>
                    <span className={t.type === 'income' ? 'font-medium text-foreground' : 'font-medium text-muted-foreground'}>
                      {t.type === 'income' ? '+' : '-'}
                      <MoneyValue value={t.amount} />
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
