'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, MoneyValue } from '@/components/ui/money-value'

export interface CategoryDatum {
  name: string
  value: number
  color: string
}

export interface CategoryBreakdownProps {
  data: CategoryDatum[]
}

type ViewMode = 'donut' | 'bars' | 'segmented'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * "Onde o dinheiro saiu" — componente compartilhado entre Visão Geral e
 * Relatórios (mesma informação, apresentada nos dois lugares — decisão do
 * Marco em 2026-09-16 de manter esse card em ambas as telas).
 */
function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const [view, setView] = useState<ViewMode>('donut')
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const maxValue = Math.max(...data.map((d) => d.value), 0)

  if (data.length === 0 || total === 0) {
    return <p className="text-sm text-muted-foreground">Sem despesas registradas.</p>
  }

  let cumulative = 0
  const slices = data.map((d) => {
    const fraction = d.value / total
    const dash = fraction * CIRCUMFERENCE
    const offset = -cumulative * CIRCUMFERENCE
    cumulative += fraction
    return { ...d, dash, offset, pct: fraction * 100 }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-muted p-1">
        {(
          [
            ['donut', 'Pizza'],
            ['bars', 'Barras'],
            ['segmented', 'Segmentada'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              view === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'donut' && (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="Donut de despesas por categoria">
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="14" />
            {slices.map((s) => (
              <circle
                key={s.name}
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={s.offset}
                transform="rotate(-90 60 60)"
              >
                <title>{`${s.name} — ${formatCurrency(s.value)} (${s.pct.toFixed(0)}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="flex flex-col gap-2">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-4 text-sm">
                <Badge color={s.color}>{s.name}</Badge>
                <span className="font-medium text-foreground">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'bars' && (
        <div className="flex flex-col gap-3">
          {slices.map((s) => (
            <div key={s.name} className="flex flex-col gap-1.5" title={`${s.name} — ${formatCurrency(s.value)} (${s.pct.toFixed(0)}%)`}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <Badge color={s.color}>{s.name}</Badge>
                <span className="font-medium text-foreground"><MoneyValue value={s.value} /></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(s.value / maxValue) * 100}%`, backgroundColor: s.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'segmented' && (
        <div className="flex flex-col gap-3">
          <div className="flex h-7 w-full overflow-hidden rounded-md">
            {slices.map((s) => (
              <div
                key={s.name}
                style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                title={`${s.name} — ${formatCurrency(s.value)} (${s.pct.toFixed(0)}%)`}
                className="h-full border-r-2 border-card last:border-r-0"
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-4 text-sm">
                <Badge color={s.color}>{s.name}</Badge>
                <span className="font-medium text-foreground">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { CategoryBreakdown }
