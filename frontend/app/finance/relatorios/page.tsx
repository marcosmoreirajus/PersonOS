'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CategoryBreakdown, rankWithUncategorized, REVISAR_SEM_CATEGORIA } from '../_components/CategoryBreakdown'
import { categoryColorByRank } from '@/lib/category-colors'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type DashboardSummary = {
  balance: number
  income: number
  expense: number
  expenses_by_category: Record<string, number>
  /** Gasto efetivado com `category_id` nulo — o balde virtual do spec. */
  uncategorized_expense: number
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

  const uncategorized = summary.uncategorized_expense ?? 0
  const categoryData = rankWithUncategorized(
    Object.entries(summary.expenses_by_category).map(([name, value]) => ({ name, value })),
    uncategorized,
    categoryColorByRank
  )
  // Sem transferência interna nas somas, categorias + balde = despesa do card.
  const pctSemCategoria = summary.expense > 0 ? (uncategorized / summary.expense) * 100 : 0

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
        <CardContent className="flex flex-col gap-4">
          {uncategorized > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground">
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {/* Arredonda para cima: 0,4% sem categoria não pode aparecer como 0%. */}
              <span>
                {Math.ceil(pctSemCategoria)}% das despesas (<MoneyValue value={uncategorized} />) estão sem categoria.
              </span>
              <Link href={REVISAR_SEM_CATEGORIA} className="font-medium underline underline-offset-4">
                Classificar agora
              </Link>
            </p>
          )}
          <CategoryBreakdown data={categoryData} />
        </CardContent>
      </Card>
    </div>
  )
}
