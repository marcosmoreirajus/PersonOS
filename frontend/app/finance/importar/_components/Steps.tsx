import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Indicador de passos. Feito à mão: o `@beui/adaptive-stepper` é um contador
 * numérico (+/−), apesar do nome, e não um indicador de etapas.
 */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas da importação">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                done && 'border-foreground bg-foreground text-background',
                active && 'border-foreground text-foreground',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={2} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-sm', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-border" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
