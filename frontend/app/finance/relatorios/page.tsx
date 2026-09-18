'use client'

import { useEffect, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CategoryBreakdown, type CategoryDatum } from '../_components/CategoryBreakdown'
import { categoryColorByRank } from '@/lib/category-colors'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type DashboardSummary = {
  balance: number
  income: number
  expense: number
  expenses_by_category: Record<string, number>
}

export default function RelatoriosPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const dashRes = await fetch(`${API_URL}/api/dashboard/${CURRENT_USER_ID}`)
        const dashJson = await dashRes.json()
        if (!cancelled) {
          setSummary(dashJson.data)
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar os relatórios.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
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

  const categoryData: CategoryDatum[] = Object.entries(summary.expenses_by_category)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .map((d, rank) => ({ ...d, color: categoryColorByRank(rank) }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Saldo</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={summary.balance} /></CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Receita</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={summary.income} /></CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Despesa</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={summary.expense} /></CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Despesas por categoria</CardTitle>
          <CardDescription>Onde o dinheiro saiu, do mês inteiro registrado</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryBreakdown data={categoryData} />
        </CardContent>
      </Card>
    </div>
  )
}
