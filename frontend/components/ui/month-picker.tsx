'use client'

import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface MonthPickerProps {
  value: Date
  onChange: (date: Date) => void
  className?: string
}

/**
 * Seletor de mês/ano — por decisão do Marco (2026-09-16), é só visual por
 * enquanto: não filtra dado nenhum, só guarda o mês escolhido em estado.
 */
function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(value.getFullYear())
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setViewYear(value.getFullYear())
      }}
    >
      <Popover.Trigger
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-shadow hover:shadow-md',
          className
        )}
      >
        <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="capitalize">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start">
          <Popover.Popup className="w-56 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none">
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <button
                type="button"
                aria-label="Ano anterior"
                onClick={() => setViewYear((y) => y - 1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span>{viewYear}</span>
              <button
                type="button"
                aria-label="Próximo ano"
                onClick={() => setViewYear((y) => y + 1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => {
                const selected = viewYear === value.getFullYear() && i === value.getMonth()
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(new Date(viewYear, i, 1))
                      setOpen(false)
                    }}
                    className={cn(
                      'rounded-md py-1.5 text-xs font-medium transition-colors',
                      selected
                        ? 'bg-foreground text-background'
                        : 'text-secondary-foreground hover:bg-accent'
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { MonthPicker }
