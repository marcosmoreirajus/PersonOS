'use client'

import { Popover } from '@base-ui/react/popover'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MoneyValue } from '@/components/ui/money-value'
import { TYPE_META, type ScheduledItem } from './types'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export interface MonthCalendarProps {
  items: ScheduledItem[]
  month: Date
  onMonthChange: (month: Date) => void
}

function MonthCalendar({ items, month, onMonthChange }: MonthCalendarProps) {
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

  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-foreground">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}

        {Array.from({ length: leadingEmpty }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayItems = itemsByDay.get(day) ?? []
          const isToday =
            today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day

          const cell = (
            <div
              className={cn(
                'flex aspect-square flex-col justify-between rounded-tl-card-cut border border-border bg-canvas p-1.5',
                isToday && 'border-foreground'
              )}
            >
              <span className="text-[11px] font-medium text-secondary-foreground">{day}</span>
              <div className="flex flex-wrap gap-0.5">
                {dayItems.map((item) => (
                  <span
                    key={item.id}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: TYPE_META[item.type].color }}
                  />
                ))}
              </div>
            </div>
          )

          if (dayItems.length === 0) {
            return <div key={day}>{cell}</div>
          }

          return (
            <Popover.Root key={day}>
              <Popover.Trigger className="text-left">{cell}</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={6}>
                  <Popover.Popup className="min-w-56 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none">
                    <ul className="flex flex-col gap-2">
                      {dayItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-secondary-foreground">{item.name}</span>
                          <span className="font-medium text-foreground"><MoneyValue value={item.value} /></span>
                        </li>
                      ))}
                    </ul>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )
        })}
      </div>
    </div>
  )
}

export { MonthCalendar }
