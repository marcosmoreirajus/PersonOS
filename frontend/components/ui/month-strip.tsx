'use client'

import type { ReactNode } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface MonthStripProps {
  value: Date
  onChange: (date: Date) => void
  /**
   * Alerta opcional por mês. Retornando algo diferente de `null`, o mês ganha
   * um ponto vermelho e o conteúdo aparece num tooltip ao passar o mouse.
   */
  getMonthAlert?: (month: Date) => ReactNode | null
  className?: string
}

const arrowClass =
  'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'

/**
 * Faixa com os 12 meses do ano sempre visíveis — alternativa ao MonthPicker
 * quando o usuário precisa ver algo POR MÊS sem abrir nada (ex.: pendências
 * em Agendadas). Decisão do Marco (18/09): com o dropdown, pra saber se um
 * mês tinha pendência era preciso selecioná-lo primeiro.
 */
function MonthStrip({ value, onChange, getMonthAlert, className }: MonthStripProps) {
  const year = value.getFullYear()
  const monthIndex = value.getMonth()
  const today = new Date()

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" aria-label="Ano anterior" onClick={() => onChange(new Date(year - 1, monthIndex, 1))} className={arrowClass}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="w-10 text-center text-sm font-semibold text-foreground">{year}</span>
        <button type="button" aria-label="Próximo ano" onClick={() => onChange(new Date(year + 1, monthIndex, 1))} className={arrowClass}>
          <ChevronRight className="size-4" />
        </button>
        {/* A faixa mostra um ano inteiro, então o mês de hoje já aparece
            marcado — mas só quando se está no ano dele. Navegando por ano, o
            atalho evita contar cliques de volta. */}
        {(year !== today.getFullYear() || monthIndex !== today.getMonth()) && (
          <button
            type="button"
            onClick={() => onChange(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="ml-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            Hoje
          </button>
        )}
      </div>

      {/* Rola só a faixa (não a página) em telas estreitas. */}
      <div className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-border bg-muted p-1">
        {MONTHS.map((m, i) => {
          const month = new Date(year, i, 1)
          const alert = getMonthAlert?.(month) ?? null
          const selected = i === monthIndex
          const isCurrent = today.getFullYear() === year && today.getMonth() === i

          return (
            <Tooltip.Root key={m} disabled={!alert}>
              <Tooltip.Trigger
                delay={150}
                aria-pressed={selected}
                aria-label={`${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}${alert ? ', com pendências' : ''}`}
                onClick={() => onChange(month)}
                className={cn(
                  'relative shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                  isCurrent && !selected && 'text-foreground underline decoration-2 underline-offset-4'
                )}
              >
                {m}
                {alert && (
                  <span aria-hidden="true" className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive" />
                )}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={8}>
                  <Tooltip.Popup className="w-72 rounded-md bg-popover text-popover-foreground shadow-md outline-none">
                    {alert}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          )
        })}
      </div>
    </div>
  )
}

export { MonthStrip }
