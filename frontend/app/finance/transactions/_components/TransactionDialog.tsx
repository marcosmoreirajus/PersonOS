'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
// Formulário usa o Input animado (rótulo, erro com shake e linha de erro
// reservada). Ver a convenção em docs/design-system.md: campo de formulário
// usa `motion/input`; campo de tela (busca, filtro) usa `ui/input`.
import { Input } from '@/components/motion/input'
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

type Repeticao = 'avista' | 'installment' | 'recurring'
type Frequencia = 'monthly' | 'biweekly' | 'weekly'

const REPETICOES: { value: Repeticao; label: string }[] = [
  { value: 'avista', label: 'À vista' },
  { value: 'installment', label: 'Parcelado' },
  { value: 'recurring', label: 'Recorrente' },
]

const FREQUENCIAS: { value: Frequencia; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'weekly', label: 'Semanal' },
]

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [repeticao, setRepeticao] = useState<Repeticao>('avista')
  const [parcelas, setParcelas] = useState('12')
  const [frequencia, setFrequencia] = useState<Frequencia>('monthly')
  const [ate, setAte] = useState('')
  const [saving, setSaving] = useState(false)
  const [erros, setErros] = useState<{ amount?: string; description?: string; category?: string }>({})

  // Reidrata ao abrir: em edição e em duplicação o formulário parte do
  // lançamento de origem; em criação, de um estado limpo.
  useEffect(() => {
    if (!open) return
    setErros({})
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
    // Repetição não é herdada ao duplicar: duplicar copia o lançamento,
    // não o contrato que o gerou — senão um clique criaria 24 registros.
    setRepeticao('avista')
  }, [open, seed])

  /**
   * Prévia da divisão.
   *
   * Quando o total não divide exato, a sobra de centavos vai para a última
   * parcela — e isso é mostrado, não escondido: o total exibido no app é a
   * soma das parcelas, então ele precisa bater com o que foi digitado.
   */
  const previaParcelas = (() => {
    const total = Number(amount.replace(/\./g, '').replace(',', '.'))
    const n = Number(parcelas)
    if (!total || !n || n < 2) return 'Informe o total e o nº de parcelas'
    const parcela = Math.round((total / n) * 100) / 100
    const ultima = Math.round((total - parcela * (n - 1)) * 100) / 100
    return ultima === parcela
      ? `${n}x de ${moeda(parcela)}`
      : `${n - 1}x de ${moeda(parcela)} + 1x de ${moeda(ultima)}`
  })()

  async function submit(addAnother: boolean) {
    const valor = Number(amount.replace(/\./g, '').replace(',', '.'))
    // Todos os campos são validados de uma vez: apontar um erro por vez faz o
    // usuário corrigir, salvar e descobrir o próximo.
    const novos = {
      amount: !valor || valor <= 0 ? 'Informe um valor maior que zero.' : undefined,
      description: !description.trim() ? 'A descrição é obrigatória.' : undefined,
      category: !categoryId ? 'Escolha uma categoria.' : undefined,
    }
    setErros(novos)
    if (novos.amount || novos.description || novos.category) return

    setSaving(true)
    try {
      const corpo = {
        category_id: Number(categoryId),
        type,
        amount: valor,
        description: description.trim(),
        due_date: date,
      }

      // Série com fim conhecido (nº de parcelas ou data-limite) gera tudo; sem
      // fim, o backend materializa a janela de 12 meses.
      const series =
        repeticao === 'installment'
          ? { kind: 'installment', frequency: 'monthly', total_count: Number(parcelas) }
          : repeticao === 'recurring'
            ? { kind: 'recurring', frequency: frequencia, end_date: ate || null }
            : null

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
              // Lançamento avulso é fato consumado: nasce efetivado na data
              // escolhida. Série é compromisso futuro — as ocorrências nascem
              // sem efetivação, e cada uma é marcada quando o dinheiro se move.
              settled_at: series ? null : date,
              source: 'manual',
              ...(series ? { series } : {}),
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
      setErros({ amount: 'Não foi possível salvar a transação.' })
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
            <Input
              id="amount"
              label={repeticao === 'installment' ? 'Valor total' : 'Valor'}
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={setAmount}
              error={erros.amount}
              reserveErrorLine
            />
            <Input id="date" label="Data" type="date" value={date} onChange={setDate} reserveErrorLine />
          </div>

          <Input
            id="description"
            label="Descrição"
            placeholder="Descreva a transação"
            value={description}
            onChange={setDescription}
            error={erros.description}
            reserveErrorLine
          />

          {!editando && (
            <Field>
              <FieldLabel>Repetição</FieldLabel>
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {REPETICOES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRepeticao(r.value)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      repeticao === r.value
                        ? 'bg-background font-medium text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {repeticao === 'installment' && (
                <div className="mt-2 flex items-end gap-3">
                  <Input
                    id="parcelas"
                    label="Parcelas"
                    type="number"
                    min={2}
                    value={parcelas}
                    onChange={setParcelas}
                    className="w-32"
                  />
                  {/* Digita-se o total e o app mostra a parcela — é assim que
                      a compra é feita ("6.000 em 24x"). O que fica guardado é o
                      valor da parcela, que é o que aparece na fatura e o que a
                      importação vai tentar casar. */}
                  <p className="pb-1.5 text-xs text-muted-foreground">{previaParcelas}</p>
                </div>
              )}

              {repeticao === 'recurring' && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div className="flex gap-1 rounded-xl bg-muted p-1">
                    {FREQUENCIAS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFrequencia(f.value)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm transition-colors',
                          frequencia === f.value
                            ? 'bg-background font-medium text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <Input id="ate" label="Até (opcional)" type="date" value={ate} onChange={setAte} className="w-44" />
                  <p className="pb-1.5 text-xs text-muted-foreground">
                    {ate ? 'Gera até a data informada.' : 'Sem data de fim: gera os próximos 12 meses.'}
                  </p>
                </div>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="category">Categoria</FieldLabel>
            {/* Combobox com busca: com 17 categorias (e mais quando virarem
                customizáveis), percorrer a lista inteira num select nativo é
                atrito em cima do caminho mais usado do app. */}
            <CategoryPicker id="category" categories={categories} value={categoryId} onChange={setCategoryId} />
            {erros.category && <FieldError>{erros.category}</FieldError>}
          </Field>
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
