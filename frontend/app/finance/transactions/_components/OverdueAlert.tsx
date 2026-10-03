'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MoneyValue } from '@/components/ui/money-value'
import { api } from '@/lib/api'
import { categoryIcon } from '@/lib/category-icons'
import { cn } from '@/lib/utils'
import { hojeLocal, formatDateBR } from '@/lib/dates'

export type OverdueTransaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  /** Onde o lançamento vive — banco ou cartão. Nulo = ainda não há módulo. */
  account_id: number | null
  due_date: string
  settled_at: string | null
}

/** `accountNames[account_id] -> nome amigável` (banco/cartão). Vem do futuro módulo. */
export type OverdueAccountNames = Record<number, string>

type Categoria = { id: number; name: string; icon: string }

/** Rótulo amigável da conta do lançamento: nome do banco/cartão ou "s/ conta". */
function contaLabel(t: OverdueTransaction, names?: OverdueAccountNames) {
  const nome = t.account_id != null ? names?.[t.account_id] : undefined
  return nome ?? 's/ conta'
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
  accountNames,
}: {
  transactions: OverdueTransaction[]
  categories: Categoria[]
  onChanged: () => void
  /** Rótulo amigável de cada conta (banco/cartão). Opcional: vem do futuro módulo. */
  accountNames?: OverdueAccountNames
}) {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = useMemo(() => hojeLocal(), [])
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
    setErro(null)
    try {
      await api(`/api/transactions/${t.id}`, {
        method: 'PATCH',
        // Efetiva na data de hoje, não na de vencimento: o dinheiro se moveu
        // agora, e é isso que `settled_at` registra.
        body: { settled_at: hoje, scope: 'only_this' },
      })
      onChanged()
    } catch (e) {
      // Antes a linha sumia da lista mesmo sem ter sido efetivada — a tela
      // afirmava um pagamento que o backend nunca registrou.
      setErro(e instanceof Error ? e.message : 'Não foi possível confirmar.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      {/* `overflow-hidden` porque o hover do gatilho é retangular: sem recorte,
          o preenchimento vaza pelos cantos arredondados do container. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
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
            {erro && (
              <p className="px-4 pb-2 text-xs text-destructive" role="alert">
                {erro}
              </p>
            )}
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
                        {formatDateBR(t.due_date)} · {dias} {dias === 1 ? 'dia' : 'dias'} em atraso ·{' '}
                        {contaLabel(t, accountNames)}
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
                      size="icon"
                      className={cn(
                        'size-8 shrink-0',
                        // O _"marcar"_ é a mesma ação para os dois lados; o que muda
                        // é o eixo (pagar/cobrar) — e é isso que a cor do ícone diz:
                        // recebimento confirma em verde, despesa em neutro.
                        t.type === 'income' && 'text-positive'
                      )}
                      disabled={salvando === t.id}
                      onClick={() => efetivar(t)}
                      aria-label={t.type === 'income' ? 'Marcar recebido' : 'Marcar pago'}
                      title={t.type === 'income' ? 'Marcar recebido' : 'Marcar pago'}
                    >
                      {salvando === t.id ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                      )}
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
