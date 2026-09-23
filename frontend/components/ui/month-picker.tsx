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

const arrowClass =
  'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'

/**
 * Seletor de mês/ano. Só guarda o mês escolhido — quem usa decide o que
 * filtrar com ele. Setas ‹ › fora do popover pulam 1 mês; dentro, as setas
 * de ano trocam o ano na hora (mantendo o mês) e a grade escolhe o mês —
 * pedido do Marco, 18/09. Pra ver algo por mês sem abrir nada, usar MonthStrip.
 */
function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const year = value.getFullYear()
  const monthIndex = value.getMonth()

  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth()
  const noMesAtual = year === anoAtual && monthIndex === mesAtual

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(new Date(year, monthIndex - 1, 1))} className={arrowClass}>
        <ChevronLeft className="size-4" />
      </button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-shadow hover:shadow-md">
          <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="capitalize">{label}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align="start">
            <Popover.Popup className="w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <button
                  type="button"
                  aria-label="Ano anterior"
                  onClick={() => onChange(new Date(year - 1, monthIndex, 1))}
                  className={arrowClass}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span>{year}</span>
                <button
                  type="button"
                  aria-label="Próximo ano"
                  onClick={() => onChange(new Date(year + 1, monthIndex, 1))}
                  className={arrowClass}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => {
                  const ehMesAtual = year === anoAtual && i === mesAtual
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onChange(new Date(year, i, 1))
                        setOpen(false)
                      }}
                      className={cn(
                        'rounded-md py-1.5 text-xs font-medium transition-colors',
                        i === monthIndex
                          ? 'bg-foreground text-background'
                          : 'text-secondary-foreground hover:bg-accent',
                        // O mês de hoje ganha um anel quando NÃO é o selecionado:
                        // no selecionado o fundo sólido já o distingue, e somar
                        // os dois destaques faria parecer um terceiro estado.
                        ehMesAtual && i !== monthIndex && 'ring-1 ring-border ring-inset'
                      )}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>

              {/* Voltar ao mês de hoje é o caminho mais usado depois de
                  navegar — sem isso, quem foi parar em 2028 precisa contar
                  cliques de volta. Desabilitado quando já se está nele, pra
                  não oferecer uma ação sem efeito. */}
              <button
                type="button"
                disabled={noMesAtual}
                onClick={() => {
                  onChange(new Date(anoAtual, mesAtual, 1))
                  setOpen(false)
                }}
                className="mt-2 w-full rounded-md border border-border py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Ir para o mês atual
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(new Date(year, monthIndex + 1, 1))} className={arrowClass}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export { MonthPicker }
