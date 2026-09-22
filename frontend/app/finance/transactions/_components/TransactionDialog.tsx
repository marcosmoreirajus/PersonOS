'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { categoryIcon } from '@/lib/category-icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Category = {
  id: number
  name: string
  icon: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  userId: number
  onCreated: () => void
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Lançamento manual.
 *
 * Duas decisões da sabatina moldam este formulário:
 * - a **data é escolhida** (antes o backend gravava sempre `new Date()`, o que
 *   fazia o histórico mentir quando o registro era feito dias depois);
 * - a **categoria é obrigatória**. É o que garante que `category_id = null`
 *   signifique sempre "o classificador não soube", nunca "o usuário pulou" —
 *   e é por isso que não existe opção "Sem categoria" neste seletor.
 */
export function TransactionDialog({ open, onOpenChange, categories, userId, onCreated }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(hoje)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset(keepOpen: boolean) {
    setAmount('')
    setDescription('')
    // Tipo, data e categoria ficam: quem lança em sequência costuma repetir os três.
    setError(null)
    if (!keepOpen) onOpenChange(false)
  }

  async function submit(addAnother: boolean) {
    const valor = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!valor || valor <= 0) return setError('Informe um valor maior que zero.')
    if (!description.trim()) return setError('A descrição é obrigatória.')
    if (!categoryId) return setError('Escolha uma categoria.')

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          category_id: Number(categoryId),
          type,
          amount: valor,
          description: description.trim(),
          due_date: date,
          // Lançamento manual é fato consumado: nasce efetivado na data escolhida.
          settled_at: date,
          source: 'manual',
        }),
      })
      if (!res.ok) throw new Error()
      onCreated()
      reset(addAnother)
    } catch {
      setError('Não foi possível registrar a transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançamento manual</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Entrada x Saída — dois botões de largura igual, o ativo tintado
              pela cor semântica do próprio eixo (ganho/perda). */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(['income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  type === t
                    ? t === 'income'
                      ? 'bg-background text-positive shadow-sm'
                      : 'bg-background text-destructive shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'income' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="amount">Valor</FieldLabel>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Data</FieldLabel>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Input
              id="description"
              placeholder="Descreva a transação"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="category">Categoria</FieldLabel>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Escolha uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => {
                  const Icon = categoryIcon(c.icon)
                  return (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                        {c.name}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Salvar e adicionar outra
            </Button>
            <Button onClick={() => submit(false)} disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar transação'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionDialog
