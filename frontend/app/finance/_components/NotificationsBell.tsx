'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, ChevronRight, CircleAlert, Tag, type LucideIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MoneyValue } from '@/components/ui/money-value'
import { cn } from '@/lib/utils'
import { hojeLocal } from '@/lib/dates'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

/** Janela do aviso "vence em breve", contando hoje. */
const DIAS_A_VENCER = 7

type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  due_date: string
  settled_at: string | null
  category_id: number | null
}

type Aviso = {
  id: string
  icon: LucideIcon
  title: string
  description: string
  href: string
  /** Em aberto, separado por sentido: somar entradas com saídas não diz nada. */
  aPagar?: number
  aReceber?: number
  urgente?: boolean
}

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/**
 * Avisos derivados dos lançamentos — nada é gravado como "notificação". Só
 * entra aviso com algo a fazer, e cada um leva à tela onde se resolve; o
 * detalhe (dar baixa, categorizar) continua lá, não é repetido aqui.
 */
function derivarAvisos(transactions: Transaction[]): Aviso[] {
  const hoje = hojeLocal()
  const limite = somarDias(hoje, DIAS_A_VENCER - 1)

  const abertos = transactions.filter((t) => !t.settled_at)
  const atrasados = abertos.filter((t) => t.due_date < hoje)
  const aVencer = abertos.filter((t) => t.due_date >= hoje && t.due_date <= limite)
  const semCategoria = transactions.filter((t) => t.category_id == null)
  const soma = (list: Transaction[], tipo: Transaction['type']) =>
    list.filter((t) => t.type === tipo).reduce((s, t) => s + t.amount, 0)

  const avisos: Aviso[] = []
  if (atrasados.length > 0) {
    avisos.push({
      id: 'atrasados',
      icon: CircleAlert,
      title: `${plural(atrasados.length, 'lançamento', 'lançamentos')} em atraso`,
      description: 'Vencidos e ainda sem baixa.',
      href: '/finance/transactions',
      aPagar: soma(atrasados, 'expense'),
      aReceber: soma(atrasados, 'income'),
      urgente: true,
    })
  }
  if (aVencer.length > 0) {
    avisos.push({
      id: 'a-vencer',
      icon: CalendarClock,
      title: `${plural(aVencer.length, 'vence', 'vencem')} nos próximos ${DIAS_A_VENCER} dias`,
      description: 'Contas e recebimentos em aberto.',
      href: '/finance/agendadas',
      aPagar: soma(aVencer, 'expense'),
      aReceber: soma(aVencer, 'income'),
    })
  }
  if (semCategoria.length > 0) {
    avisos.push({
      id: 'sem-categoria',
      icon: Tag,
      title: `${plural(semCategoria.length, 'lançamento', 'lançamentos')} sem categoria`,
      description: 'Ficam fora dos gráficos por categoria até serem revisados.',
      href: '/finance/transactions',
    })
  }
  return avisos
}

/** Sino de avisos no cabeçalho de Finanças, ao lado do olho. */
export function NotificationsBell() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/transactions/user/${CURRENT_USER_ID}`)
      const json = await res.json()
      setTransactions(json.data || [])
    } catch {
      // Sem dados o sino só fica sem contador; as telas mostram o erro de carga.
    }
  }, [])

  // Recarrega a cada troca de tela e ao abrir: dar baixa ou categorizar em
  // outra tela precisa refletir no contador sem recarregar a página.
  useEffect(() => {
    carregar()
  }, [carregar, pathname])

  const avisos = useMemo(() => derivarAvisos(transactions), [transactions])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) carregar()
      }}
    >
      <PopoverTrigger
        aria-label={avisos.length > 0 ? `Avisos: ${avisos.length}` : 'Avisos: nenhum'}
        title="Avisos"
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground data-popup-open:text-foreground"
      >
        <Bell className="size-4" />
        {avisos.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums"
          >
            {avisos.length}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 gap-1 p-1.5">
        <p className="px-2.5 pt-1.5 pb-1 text-sm font-semibold text-foreground">Avisos</p>
        {avisos.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">Tudo em dia.</p>
        ) : (
          <ul className="flex flex-col">
            {avisos.map((a) => {
              const Icon = a.icon
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted',
                        a.urgente ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium text-foreground">{a.title}</span>
                      <span className="text-xs text-muted-foreground">{a.description}</span>
                      {(!!a.aPagar || !!a.aReceber) && (
                        <span className="flex flex-wrap gap-x-3 text-xs font-medium tabular-nums">
                          {!!a.aPagar && (
                            <span className={a.urgente ? 'text-destructive' : 'text-foreground'}>
                              <MoneyValue value={a.aPagar} /> a pagar
                            </span>
                          )}
                          {!!a.aReceber && (
                            <span className="text-positive">
                              <MoneyValue value={a.aReceber} /> a receber
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
