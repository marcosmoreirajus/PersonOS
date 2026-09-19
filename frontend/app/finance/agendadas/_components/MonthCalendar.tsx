'use client'

import { Popover } from '@base-ui/react/popover'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MoneyValue } from '@/components/ui/money-value'
import { KIND_META, effectiveStatus, scheduledKind, signedValue, type ScheduledItem, type ScheduledKind } from './types'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const KIND_ORDER: ScheduledKind[] = ['receita', 'despesa', 'fatura']

export interface MonthCalendarProps {
  items: ScheduledItem[]
  month: Date
}

function SignedMoney({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      {value < 0 ? '−' : '+'}
      <MoneyValue value={Math.abs(value)} />
    </span>
  )
}

/**
 * Calendário de vencimentos. Cada dia mostra o tipo do que vence (ícone por
 * receita/despesa/fatura, ver legenda), o saldo do dia e o estado: ponto
 * vermelho = algo em atraso, ✓ = tudo quitado. Dias sem nada ficam apagados e
 * não clicáveis (mesmo padrão do "Saídas por dia" da Visão Geral). Células de
 * altura fixa e largura total, não aspect-square — ver padrão técnico de 17/09.
 */
function MonthCalendar({ items, month }: MonthCalendarProps) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const today = new Date()

  const firstDay = new Date(year, monthIndex, 1)
  // getDay(): 0=Dom..6=Sáb — convertendo pra semana começando na Segunda.
  const leadingEmpty = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const itemsByDay = new Map<number, ScheduledItem[]>()
  for (const item of items) {
    const due = new Date(`${item.due_date}T00:00:00`)
    if (due.getFullYear() === year && due.getMonth() === monthIndex) {
      const day = due.getDate()
      itemsByDay.set(day, [...(itemsByDay.get(day) ?? []), item])
    }
  }

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex
  const kindsInMonth = new Set(items.map(scheduledKind))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}

        {Array.from({ length: leadingEmpty }).map((_, i) => (
          <div key={`empty-${i}`} className="h-[72px]" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayItems = itemsByDay.get(day) ?? []
          const isToday = isCurrentMonth && today.getDate() === day
          const hasItems = dayItems.length > 0
          const statuses = dayItems.map((item) => effectiveStatus(item, today))
          const hasOverdue = statuses.includes('overdue')
          const allSettled = hasItems && statuses.every((s) => s === 'paid')
          const kinds = KIND_ORDER.filter((k) => dayItems.some((item) => scheduledKind(item) === k))
          const net = dayItems.reduce((sum, item) => sum + signedValue(item), 0)

          const cell = (
            <div
              className={cn(
                'flex h-[72px] w-full flex-col justify-between rounded-tl-card-cut border border-border bg-canvas p-1.5 text-left transition-shadow',
                isToday && 'border-foreground',
                !hasItems && 'opacity-50',
                hasItems && 'hover:shadow-md',
                hasOverdue && 'border-destructive/60'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-secondary-foreground">{day}</span>
                {hasOverdue ? (
                  <span className="size-1.5 rounded-full bg-destructive" aria-label="Em atraso" />
                ) : allSettled ? (
                  <Check className="size-3 text-muted-foreground" aria-label="Quitado" />
                ) : null}
              </div>
              {hasItems && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex gap-0.5">
                    {kinds.map((k) => {
                      const { icon: Icon, className } = KIND_META[k]
                      return <Icon key={k} className={cn('size-3', className)} aria-hidden="true" />
                    })}
                  </div>
                  <SignedMoney
                    value={net}
                    className={cn('truncate text-[11px] font-medium', allSettled ? 'text-muted-foreground line-through' : 'text-foreground')}
                  />
                </div>
              )}
            </div>
          )

          if (!hasItems) {
            return <div key={day}>{cell}</div>
          }

          return (
            <Popover.Root key={day}>
              <Popover.Trigger className="block w-full" aria-label={`Ver vencimentos do dia ${day}`}>
                {cell}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={6}>
                  <Popover.Popup className="w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none">
                    <p className="mb-2 text-xs font-medium capitalize text-muted-foreground">
                      {new Date(year, monthIndex, day).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {dayItems.map((item, idx) => {
                        const kind = scheduledKind(item)
                        const { icon: Icon, className, label } = KIND_META[kind]
                        const status = statuses[idx]
                        return (
                          <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-start gap-2">
                              <Icon className={cn('mt-0.5 size-3.5 shrink-0', className)} aria-label={label} />
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-foreground">{item.name}</span>
                                <span
                                  className={cn(
                                    'text-[11px]',
                                    status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                                  )}
                                >
                                  {label} ·{' '}
                                  {status === 'overdue'
                                    ? 'Em atraso'
                                    : status === 'paid'
                                      ? item.type === 'income'
                                        ? 'Recebido'
                                        : 'Pago'
                                      : item.type === 'income'
                                        ? 'A receber'
                                        : 'A vencer'}
                                </span>
                              </div>
                            </div>
                            <SignedMoney value={signedValue(item)} className="font-medium text-foreground" />
                          </li>
                        )
                      })}
                    </ul>
                    {dayItems.length > 1 && (
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
                        <span className="text-muted-foreground">Saldo do dia</span>
                        <SignedMoney value={net} className="font-semibold text-foreground" />
                      </div>
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        {KIND_ORDER.map((k) => {
          const { icon: Icon, className, label } = KIND_META[k]
          return (
            <span key={k} className={cn('flex items-center gap-1.5', !kindsInMonth.has(k) && 'opacity-50')}>
              <Icon className={cn('size-3.5', className)} aria-hidden="true" />
              {label}
            </span>
          )
        })}
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-destructive" />
          Em atraso
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-3 text-muted-foreground" aria-hidden="true" />
          Quitado
        </span>
        {isCurrentMonth && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-tl-[2px] border border-foreground bg-canvas" />
            Hoje
          </span>
        )}
        <span>Toque num dia para ver o detalhe.</span>
      </div>
    </div>
  )
}

export { MonthCalendar }
