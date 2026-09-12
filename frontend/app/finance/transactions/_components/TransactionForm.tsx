'use client'

import { useState } from 'react'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

export type Category = {
  id: number
  name: string
  icon: string | null
}

type TransactionFormProps = {
  categories: Category[]
  onCreated: () => void
}

export default function TransactionForm({ categories, onCreated }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState<number | ''>(categories[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId || !amount) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: CURRENT_USER_ID,
          category_id: categoryId,
          type,
          amount: parseFloat(amount),
          description: description || null,
          transaction_date: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Falha ao criar transação')

      setAmount('')
      setDescription('')
      onCreated()
    } catch {
      setError('Não foi possível registrar a transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova transação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                type === 'expense'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                type === 'income'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              Receita
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-foreground">
              Categoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm font-medium text-foreground">
              Valor (R$)
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Descrição (opcional)
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
