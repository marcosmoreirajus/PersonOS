'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CategoryPicker } from '../../_components/CategoryPicker'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Category = {
  id: number
  name: string
  icon: string
}

/** O que o diálogo precisa saber de um lançamento pra editar ou duplicar. */
export type DialogSeed = {
  /** Presente = edição; ausente = criação (inclusive ao duplicar). */
  id?: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  due_date: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  userId: number
  onSaved: () => void
  /** Preenche o formulário: edição (com `id`) ou duplicação (sem `id`). */
  seed?: DialogSeed | null
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Lançamento manual — criação, edição e duplicação.
 *
 * Duas decisões da sabatina moldam este formulário:
 * - a **data é escolhida** (antes o backend gravava sempre `new Date()`, o que
 *   fazia o histórico mentir quando o registro era feito dias depois);
 * - a **categoria é obrigatória**. É o que garante que `category_id = null`
 *   signifique sempre "o classificador não soube", nunca "o usuário pulou" —
 *   e é por isso que o seletor não tem opção "Sem categoria".
 */
export function TransactionDialog({ open, onOpenChange, categories, userId, onSaved, seed }: Props) {
  const editando = Boolean(seed?.id)

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(hoje)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reidrata ao abrir: em edição e em duplicação o formulário parte do
  // lançamento de origem; em criação, de um estado limpo.
  useEffect(() => {
    if (!open) return
    setError(null)
    if (seed) {
      setType(seed.type)
      setAmount(String(seed.amount).replace('.', ','))
      setDescription(seed.description ?? '')
      setCategoryId(seed.category_id != null ? String(seed.category_id) : '')
      setDate(seed.due_date)
    } else {
      setAmount('')
      setDescription('')
    }
  }, [open, seed])

  async function submit(addAnother: boolean) {
    const valor = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!valor || valor <= 0) return setError('Informe um valor maior que zero.')
    if (!description.trim()) return setError('A descrição é obrigatória.')
    if (!categoryId) return setError('Escolha uma categoria.')

    setSaving(true)
    setError(null)
    try {
      const corpo = {
        category_id: Number(categoryId),
        type,
        amount: valor,
        description: description.trim(),
        due_date: date,
      }

      const res = editando
        ? await fetch(`${API_URL}/api/transactions/${seed!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            // Escopo amplo em edição depende de um passo a mais na interface;
            // por ora a edição é sempre pontual.
            body: JSON.stringify({ ...corpo, scope: 'only_this' }),
          })
        : await fetch(`${API_URL}/api/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...corpo,
              user_id: userId,
              // Lançamento manual é fato consumado: nasce efetivado na data escolhida.
              settled_at: date,
              source: 'manual',
            }),
          })

      if (!res.ok) throw new Error()
      onSaved()
      if (addAnother) {
        // Tipo, data e categoria ficam: quem lança em sequência repete os três.
        setAmount('')
        setDescription('')
      } else {
        onOpenChange(false)
      }
    } catch {
      setError('Não foi possível salvar a transação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar lançamento' : 'Lançamento manual'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Entrada x Saída — o ativo tintado pela cor semântica do eixo. */}
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
            {/* Combobox com busca: com 17 categorias (e mais quando virarem
                customizáveis), percorrer a lista inteira num select nativo é
                atrito em cima do caminho mais usado do app. */}
            <CategoryPicker id="category" categories={categories} value={categoryId} onChange={setCategoryId} />
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {!editando && (
              <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Salvar e adicionar outra
              </Button>
            )}
            <Button onClick={() => submit(false)} disabled={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar transação'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionDialog
