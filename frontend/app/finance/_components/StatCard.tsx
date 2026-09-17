'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/utils'

export interface StatCardFact {
  label: string
  value: ReactNode
}

export interface StatCardProps {
  label: string
  sentence: ReactNode
  secondaryValue: ReactNode
  secondaryDesc: string
  sparklinePoints: number[]
  facts: StatCardFact[]
  expanded: boolean
  onToggle: () => void
}

/**
 * Stat card com frase narrativa + expandir sincronizado (os 4 cards da
 * Visão Geral compartilham um único estado `expanded` no pai — "grupo
 * sincronizado", decisão já validada no preview em 2026-09-14).
 */
function StatCard({ label, sentence, secondaryValue, secondaryDesc, sparklinePoints, facts, expanded, onToggle }: StatCardProps) {
  return (
    <Card className="gap-3 px-5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className="min-h-[3.2em] text-sm leading-relaxed text-foreground">{sentence}</p>
      <hr className="border-border" />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <div className="text-sm font-bold text-foreground">{secondaryValue}</div>
          <div className="text-[10px] text-muted-foreground">{secondaryDesc}</div>
        </div>
        <ChevronDown
          className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="text-foreground">
            <Sparkline points={sparklinePoints} height={48} />
          </div>
          <div className="flex justify-between gap-3">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{f.label}</span>
                <span className="text-xs font-semibold text-foreground">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export { StatCard }
