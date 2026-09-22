'use client'

import { useCallback, useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { CardGrid } from '@/components/ui/card-grid'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'
import { MoneyValue } from '@/components/ui/money-value'
import TransactionForm, { type Category } from './_components/TransactionForm'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  due_date: string
  /** Nulo enquanto o dinheiro nao se moveu. */
  settled_at: string | null
  category_id: number | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions/user/${CURRENT_USER_ID}`),
        fetch(`${API_URL}/api/categories`),
      ])
      const txJson = await txRes.json()
      const catJson = await catRes.json()
      setTransactions(
        [...(txJson.data || [])].sort(
          (a, b) => new Date(b.settled_at ?? b.due_date).getTime() - new Date(a.settled_at ?? a.due_date).getTime()
        )
      )
      setCategories(catJson.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /** `null` é o balde virtual "Sem categoria" — ausência, não uma categoria. */
  function categoryFor(id: number | null) {
    if (id == null) return undefined
    return categories.find((c) => c.id === id)
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Transações</h1>
          <ViewToggle value={view} onChange={setView} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
        ) : (
          <CardGrid view={view}>
            {transactions.map((t) => {
              const category = categoryFor(t.category_id)
              return (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{category?.icon ?? '📌'}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {t.description || category?.name || 'Sem descrição'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {category?.name ?? 'Sem categoria'} · {formatDate(t.settled_at ?? t.due_date)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={
                        t.type === 'income'
                          ? 'shrink-0 font-medium text-foreground'
                          : 'shrink-0 font-medium text-muted-foreground'
                      }
                    >
                      {t.type === 'income' ? '+' : '-'}
                      <MoneyValue value={t.amount} />
                    </span>
                  </CardContent>
                </Card>
              )
            })}
          </CardGrid>
        )}
      </div>

      <div className="w-full lg:w-80 lg:shrink-0">
        {categories.length > 0 && (
          <TransactionForm categories={categories} onCreated={fetchData} />
        )}
      </div>
    </div>
  )
}
