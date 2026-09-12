'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

// Escala de cinzas para o gráfico — mantém o design system P&B (sem cores saturadas).
const CHART_COLORS = ['#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5']

type DashboardSummary = {
  balance: number
  income: number
  expense: number
  expenses_by_category: Record<string, number>
  recent_transactions: {
    id: number
    type: 'income' | 'expense'
    amount: number
    description: string | null
    transaction_date: string
    category_id: number
  }[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function FinanceDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSummary() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/dashboard/${CURRENT_USER_ID}`)
        const json = await res.json()
        if (!cancelled) {
          setSummary(json.data)
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar o dashboard.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSummary()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error || 'Nenhum dado disponível.'}
      </div>
    )
  }

  const chartData = Object.entries(summary.expenses_by_category).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Saldo</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.balance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Receita</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Despesa</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.expense)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas registradas.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {chartData.map((entry, index) => (
                    <li key={entry.name} className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      {entry.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas transações</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent_transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.recent_transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-foreground">{t.description || 'Sem descrição'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(t.transaction_date)}</span>
                    </div>
                    <span
                      className={t.type === 'income' ? 'font-medium text-foreground' : 'font-medium text-muted-foreground'}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
