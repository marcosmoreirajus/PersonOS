'use client'

import { useCallback, useEffect, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { CardGrid } from '@/components/ui/card-grid'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'
import TransactionForm, { type Category } from './_components/TransactionForm'

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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
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
          (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
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

  function categoryFor(id: number) {
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
                          {category?.name} · {formatDate(t.transaction_date)}
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
                      {formatCurrency(t.amount)}
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
