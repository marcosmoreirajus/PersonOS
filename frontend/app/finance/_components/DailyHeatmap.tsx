'use client'

import { CalendarClock, CreditCard, TrendingDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MoneyValue } from '@/components/ui/money-value'
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const LEGEND_STEPS = [0.1, 0.3, 0.55, 0.8, 1]

export interface HeatmapTransaction {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  categoryName?: string
}

/** Saída agendada ainda não paga (vem de Agendadas). */
export interface PlannedOutflow {
  id: number
  name: string
  amount: number
  isInvoice: boolean
  overdue: boolean
}

export interface DailyHeatmapProps {
  /** Chave `YYYY-MM-DD`. Entradas são ignoradas — o quadro é só de saídas. */
  transactionsByDay: Map<string, HeatmapTransaction[]>
  /** Chave `YYYY-MM-DD`. Saídas agendadas ainda não pagas — previsibilidade do mês. */
  plannedByDay?: Map<string, PlannedOutflow[]>
  /** Mês exibido — vem do seletor de mês do topo da página, sem navegação própria aqui. */
  month: Date
}

function dayKeyFor(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function heatColor(intensity: number) {
  return `color-mix(in srgb, var(--foreground) ${10 + intensity * 65}%, var(--canvas))`
}

/**
 * "Saídas por dia" — só saídas (entradas não entram no quadro). Resumo no
 * topo (total, média por dia corrido, maior dia, quanto ainda falta pagar),
 * grid com intensidade por valor já gasto e legenda. Saídas agendadas ainda
 * não pagas aparecem como "previstas" (borda tracejada + ícone) no dia do
 * vencimento; em atraso ganha ponto vermelho — mesma linguagem do calendário
 * de Agendadas (18/09). Intensidade em escala de cinza, não âmbar — evita
 * confundir com a paleta de categoria.
 */
function DailyHeatmap({ transactionsByDay, plannedByDay, month }: DailyHeatmapProps) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const today = new Date()

  const firstDay = new Date(year, monthIndex, 1)
  const leadingEmpty = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const expensesByDay = new Map<number, HeatmapTransaction[]>()
  const plannedForDay = new Map<number, PlannedOutflow[]>()
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dayKeyFor(year, monthIndex, day)
    const items = (transactionsByDay.get(key) ?? []).filter((t) => t.type === 'expense')
    if (items.length > 0) expensesByDay.set(day, items)
    const planned = plannedByDay?.get(key) ?? []
    if (planned.length > 0) plannedForDay.set(day, planned)
  }
  const totalByDay = new Map<number, number>(
    [...expensesByDay].map(([day, items]) => [day, items.reduce((s, t) => s + t.amount, 0)])
  )
  const plannedTotalByDay = new Map<number, number>(
    [...plannedForDay].map(([day, items]) => [day, items.reduce((s, t) => s + t.amount, 0)])
  )

  const monthTotal = [...totalByDay.values()].reduce((s, v) => s + v, 0)
  const plannedTotal = [...plannedTotalByDay.values()].reduce((s, v) => s + v, 0)
  const maxExpense = Math.max(...totalByDay.values(), 0)
  const biggestDay = [...totalByDay].find(([, v]) => v === maxExpense)?.[0]

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex
  const isFutureMonth = firstDay > today
  const elapsedDays = isCurrentMonth ? today.getDate() : isFutureMonth ? 0 : daysInMonth
  const dailyAverage = elapsedDays > 0 ? monthTotal / elapsedDays : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Total de saídas no mês</span>
          <span className="text-2xl font-normal tracking-[-0.01em] text-foreground">
            <MoneyValue value={monthTotal} />
          </span>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Média por dia</span>
            <span className="text-sm font-medium text-foreground">
              <MoneyValue value={dailyAverage} />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              Maior dia{biggestDay ? ` (${String(biggestDay).padStart(2, '0')}/${String(monthIndex + 1).padStart(2, '0')})` : ''}
            </span>
            <span className="text-sm font-medium text-foreground">
              {biggestDay ? <MoneyValue value={maxExpense} /> : '—'}
            </span>
          </div>
          {plannedTotal > 0 && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Ainda a pagar</span>
              <span className="text-sm font-medium text-foreground">
                <MoneyValue value={plannedTotal} />
              </span>
              <span className="text-[11px] text-muted-foreground">
                fecha em <MoneyValue value={monthTotal + plannedTotal} />
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid w-full grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}

        {Array.from({ length: leadingEmpty }).map((_, i) => (
          <div key={`empty-${i}`} className="h-12" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayItems = expensesByDay.get(day) ?? []
          const planned = plannedForDay.get(day) ?? []
          const expense = totalByDay.get(day) ?? 0
          const plannedAmount = plannedTotalByDay.get(day) ?? 0
          const intensity = maxExpense > 0 ? expense / maxExpense : 0
          const isToday = isCurrentMonth && today.getDate() === day
          const isDark = intensity > 0.4
          const hasSpent = dayItems.length > 0
          const hasPlanned = planned.length > 0
          const hasOverdue = planned.some((p) => p.overdue)
          const clickable = hasSpent || hasPlanned

          const cell = (
            <div
              className={cn(
                'flex h-12 w-full flex-col justify-between overflow-hidden rounded-tl-card-cut border border-border px-1.5 py-1 text-left transition-shadow',
                isToday && 'border-foreground',
                hasPlanned && !hasSpent && 'border-dashed border-foreground/40',
                hasOverdue && 'border-destructive/60',
                clickable && 'cursor-pointer hover:shadow-md',
                !clickable && 'opacity-50'
              )}
              style={{ backgroundColor: hasSpent ? heatColor(intensity) : 'var(--canvas)' }}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-[11px] font-medium', isDark ? 'text-background' : 'text-secondary-foreground')}>
                  {day}
                </span>
                {hasOverdue ? (
                  <span className="size-1.5 rounded-full bg-destructive" aria-label="Saída prevista em atraso" />
                ) : hasPlanned ? (
                  <CalendarClock
                    className={cn('size-3', isDark ? 'text-background/85' : 'text-muted-foreground')}
                    aria-label="Saída prevista"
                  />
                ) : null}
              </div>
              {hasSpent ? (
                <span className={cn('truncate text-[10px] font-medium', isDark ? 'text-background/85' : 'text-foreground/80')}>
                  <MoneyValue value={expense} />
                </span>
              ) : hasPlanned ? (
                <span className="truncate text-[10px] text-muted-foreground">
                  <MoneyValue value={plannedAmount} />
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">−</span>
              )}
            </div>
          )

          if (!clickable) {
            return <div key={day}>{cell}</div>
          }

          return (
            <Dialog key={day}>
              <DialogTrigger className="block w-full text-left">{cell}</DialogTrigger>
              <DialogContent>
                <DialogTitle className="first-letter:uppercase">
                  {new Date(year, monthIndex, day).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </DialogTitle>

                {hasSpent && (
                  <section className="mt-3 flex flex-col gap-2.5">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saídas</h3>
                    <ul className="flex flex-col gap-2.5">
                      {dayItems.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-start gap-2">
                            <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-terracotta" aria-hidden="true" />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-foreground">{item.description || 'Sem descrição'}</span>
                              {item.categoryName && (
                                <span className="text-[11px] text-muted-foreground">{item.categoryName}</span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 font-medium text-foreground">
                            <MoneyValue value={item.amount} />
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-medium">
                      <span className="text-foreground">Total do dia</span>
                      <span className="text-foreground">
                        <MoneyValue value={expense} />
                      </span>
                    </div>
                    {monthTotal > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round((expense / monthTotal) * 100)}% das saídas do mês
                      </span>
                    )}
                  </section>
                )}

                {hasPlanned && (
                  <section className={cn('flex flex-col gap-2.5', hasSpent ? 'mt-5' : 'mt-3')}>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Previsto (Agendadas)
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {planned.map((p) => {
                        const Icon = p.isInvoice ? CreditCard : CalendarClock
                        return (
                          <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-start gap-2">
                              <Icon
                                className={cn('mt-0.5 size-3.5 shrink-0', p.isInvoice ? 'text-dusty-blue' : 'text-muted-foreground')}
                                aria-hidden="true"
                              />
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-foreground">{p.name}</span>
                                <span className={cn('text-[11px]', p.overdue ? 'text-destructive' : 'text-muted-foreground')}>
                                  {p.isInvoice ? 'Fatura do cartão · ' : ''}
                                  {p.overdue ? 'Em atraso' : 'A vencer'}
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 font-medium text-muted-foreground">
                              <MoneyValue value={p.amount} />
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </DialogContent>
            </Dialog>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>Menos</span>
          {LEGEND_STEPS.map((step) => (
            <span
              key={step}
              className="size-3 rounded-tl-[2px] border border-border"
              style={{ backgroundColor: heatColor(step) }}
            />
          ))}
          <span>Mais gasto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-tl-[2px] border border-dashed border-foreground/40 bg-canvas" />
          <span>Previsto (a pagar)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-destructive" />
          <span>Em atraso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex size-3 items-center justify-center rounded-tl-[2px] border border-border bg-canvas text-[9px] opacity-50">
            −
          </span>
          <span>Sem saídas</span>
        </div>
        {isCurrentMonth && (
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-tl-[2px] border border-foreground bg-canvas" />
            <span>Hoje</span>
          </div>
        )}
        <span>Toque num dia para ver o detalhe.</span>
      </div>
    </div>
  )
}

export { DailyHeatmap }
