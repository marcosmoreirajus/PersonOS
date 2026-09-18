'use client'

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

export interface DailyHeatmapProps {
  /** Chave `YYYY-MM-DD`. Entradas são ignoradas — o quadro é só de saídas. */
  transactionsByDay: Map<string, HeatmapTransaction[]>
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
 * "Saídas por dia" — só despesas (entradas não entram no quadro). Resumo no
 * topo (total, média por dia corrido, maior dia), grid com intensidade por
 * valor e legenda. Clique num dia com saída abre modal com a listagem.
 * Intensidade em escala de cinza, não âmbar — evita confundir com a paleta
 * de categoria.
 */
function DailyHeatmap({ transactionsByDay, month }: DailyHeatmapProps) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const today = new Date()

  const firstDay = new Date(year, monthIndex, 1)
  const leadingEmpty = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const expensesByDay = new Map<number, HeatmapTransaction[]>()
  for (let day = 1; day <= daysInMonth; day++) {
    const items = (transactionsByDay.get(dayKeyFor(year, monthIndex, day)) ?? []).filter((t) => t.type === 'expense')
    if (items.length > 0) expensesByDay.set(day, items)
  }
  const totalByDay = new Map<number, number>(
    [...expensesByDay].map(([day, items]) => [day, items.reduce((s, t) => s + t.amount, 0)])
  )

  const monthTotal = [...totalByDay.values()].reduce((s, v) => s + v, 0)
  const maxExpense = Math.max(...totalByDay.values(), 0)
  const biggestDay = [...totalByDay].find(([, v]) => v === maxExpense)?.[0]

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex
  const isFutureMonth = firstDay > today
  const elapsedDays = isCurrentMonth ? today.getDate() : isFutureMonth ? 0 : daysInMonth
  const dailyAverage = elapsedDays > 0 ? monthTotal / elapsedDays : 0

  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Total de saídas no mês</span>
          <span className="text-2xl font-normal tracking-[-0.01em] text-foreground">
            <MoneyValue value={monthTotal} />
          </span>
        </div>
        <div className="flex gap-8">
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
          const expense = totalByDay.get(day) ?? 0
          const intensity = maxExpense > 0 ? expense / maxExpense : 0
          const isToday = isCurrentMonth && today.getDate() === day
          const isDark = intensity > 0.4
          const hasItems = dayItems.length > 0

          const cell = (
            <div
              className={cn(
                'flex h-12 w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-tl-card-cut border border-border px-1 transition-shadow',
                isToday && 'border-foreground',
                hasItems && 'cursor-pointer hover:border-foreground/70 hover:ring-2 hover:ring-foreground/20',
                !hasItems && 'opacity-50'
              )}
              style={{ backgroundColor: hasItems ? heatColor(intensity) : 'var(--canvas)' }}
            >
              <span className={cn('text-[11px] font-medium', isDark ? 'text-background' : 'text-secondary-foreground')}>
                {day}
              </span>
              {hasItems ? (
                <span className={cn('truncate text-[10px] font-medium', isDark ? 'text-background/85' : 'text-foreground/80')}>
                  <MoneyValue value={expense} />
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">−</span>
              )}
            </div>
          )

          if (!hasItems) {
            return <div key={day}>{cell}</div>
          }

          return (
            <Dialog key={day}>
              <DialogTrigger className="block w-full text-left">{cell}</DialogTrigger>
              <DialogContent>
                <DialogTitle>
                  Saídas de {day} de {monthLabel}
                </DialogTitle>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {dayItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-secondary-foreground">
                        {item.description || item.categoryName || 'Sem descrição'}
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        <MoneyValue value={item.amount} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm font-medium">
                  <span className="text-foreground">Total do dia</span>
                  <span className="text-foreground">
                    <MoneyValue value={expense} />
                  </span>
                </div>
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
