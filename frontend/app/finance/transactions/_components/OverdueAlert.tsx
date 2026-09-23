'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MoneyValue } from '@/components/ui/money-value'
import { categoryIcon } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type OverdueTransaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  due_date: string
  settled_at: string | null
}

type Categoria = { id: number; name: string; icon: string }

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function diasDeAtraso(due: string, hoje: string) {
  const ms = new Date(`${hoje}T00:00:00Z`).getTime() - new Date(`${due}T00:00:00Z`).getTime()
  return Math.round(ms / 86400000)
}

/**
 * Aviso de lançamentos vencidos e não efetivados.
 *
 * "Atrasado" não é campo: é a leitura de `settled_at` nulo com `due_date` no
 * passado — a mesma regra da coluna Situação.
 *
 * Três decisões moldam este componente:
 *
 * 1. **Conta a pagar e recebimento não confirmado são contados separadamente.**
 *    "Não foi pago" não descreve um salário que não caiu, e as ações são
 *    diferentes: uma se paga, a outra se cobra. Somar os dois num número só
 *    repetiria o erro de misturar eixos num elemento.
 * 2. **Ignora os filtros da tela, de propósito.** O valor do aviso é mostrar o
 *    que está fora do campo de visão atual; sumir quando o usuário filtra
 *    seria desaparecer na hora em que ele é mais útil. O texto diz isso.
 * 3. **Dá para resolver daqui.** Um aviso que só informa vira ruído e para de
 *    ser lido — então cada linha traz a ação que a tira da lista.
 */
export function OverdueAlert({
  transactions,
  categories,
  onChanged,
}: {
  transactions: OverdueTransaction[]
  categories: Categoria[]
  onChanged: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState<number | null>(null)

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const categoriaPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const { aPagar, aReceber, todos } = useMemo(() => {
    const vencidos = transactions
      .filter((t) => !t.settled_at && t.due_date < hoje)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
    return {
      aPagar: vencidos.filter((t) => t.type === 'expense'),
      aReceber: vencidos.filter((t) => t.type === 'income'),
      todos: vencidos,
    }
  }, [transactions, hoje])

  if (todos.length === 0) return null

  const totalPagar = aPagar.reduce((s, t) => s + t.amount, 0)
  const totalReceber = aReceber.reduce((s, t) => s + t.amount, 0)

  async function efetivar(t: OverdueTransaction) {
    setSalvando(t.id)
    try {
      await fetch(`${API_URL}/api/transactions/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Efetiva na data de hoje, não na de vencimento: o dinheiro se moveu
        // agora, e é isso que `settled_at` registra.
        body: JSON.stringify({ settled_at: hoje, scope: 'only_this' }),
      })
      onChanged()
    } finally {
      setSalvando(null)
    }
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <div className="rounded-xl border border-border bg-card">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            >
              <CircleAlert className="size-5 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {aPagar.length > 0 && (
                  <span className="text-foreground">
                    <strong className="font-semibold">{aPagar.length}</strong>{' '}
                    {aPagar.length === 1 ? 'conta vencida' : 'contas vencidas'} ·{' '}
                    <MoneyValue value={totalPagar} className="font-medium" />
                  </span>
                )}
                {aReceber.length > 0 && (
                  <span className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{aReceber.length}</strong>{' '}
                    {aReceber.length === 1 ? 'recebimento não confirmado' : 'recebimentos não confirmados'} ·{' '}
                    <MoneyValue value={totalReceber} className="font-medium text-positive" />
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                  aberto && 'rotate-180'
                )}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          }
        />

        <CollapsibleContent>
          <div className="border-t border-border">
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Conta todos os lançamentos vencidos, independente dos filtros aplicados na lista.
            </p>
            <ul className="divide-y divide-border">
              {todos.map((t) => {
                const cat = categoriaPorId.get(t.category_id ?? -1)
                const Icon = categoryIcon(cat?.icon)
                const dias = diasDeAtraso(t.due_date, hoje)
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {t.description ?? 'Sem descrição'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(t.due_date)} · {dias} {dias === 1 ? 'dia' : 'dias'} em atraso
                      </span>
                    </span>
                    <span
                      className={cn(
                        'ml-auto shrink-0 font-medium tabular-nums',
                        t.type === 'income' ? 'text-positive' : 'text-foreground'
                      )}
                    >
                      {t.type === 'income' ? '+' : '−'}
                      <MoneyValue value={t.amount} />
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={salvando === t.id}
                      onClick={() => efetivar(t)}
                    >
                      {salvando === t.id
                        ? 'Salvando...'
                        : t.type === 'income'
                          ? 'Marcar recebido'
                          : 'Marcar pago'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default OverdueAlert
