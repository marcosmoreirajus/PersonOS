'use client'

import { cn } from '@/lib/utils'
import { TYPE_META, type ScheduledType } from './types'

export type PeriodFilter = 'month' | 'last30' | 'custom'

export interface ScheduledFiltersValue {
  type: ScheduledType | 'all'
  period: PeriodFilter
  customStart: string
  customEnd: string
}

export interface ScheduledFiltersProps {
  value: ScheduledFiltersValue
  onChange: (value: ScheduledFiltersValue) => void
}

const TYPE_OPTIONS: { value: ScheduledType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  ...(Object.entries(TYPE_META) as [ScheduledType, (typeof TYPE_META)[ScheduledType]][]).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
]

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'month', label: 'Este mês' },
  { value: 'last30', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Personalizado' },
]

function segmented<T extends string>(
  options: { value: T; label: string }[],
  current: T,
  onSelect: (value: T) => void
) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={current === opt.value}
          onClick={() => onSelect(opt.value)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            current === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// "Natureza" foi pedido como 3ª dimensão de filtro (2026-09-16), mas nunca
// foi definido o que ela representa de fato nem existe campo pra isso em
// scheduled.json — fica decorativa (só "Todas") até Marco especificar.
const NATURE_OPTIONS: { value: 'all'; label: string }[] = [{ value: 'all', label: 'Todas' }]

function ScheduledFilters({ value, onChange }: ScheduledFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {segmented(TYPE_OPTIONS, value.type, (type) => onChange({ ...value, type }))}
      {segmented(NATURE_OPTIONS, 'all', () => {})}
      {segmented(PERIOD_OPTIONS, value.period, (period) => onChange({ ...value, period }))}
      {value.period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.customStart}
            onChange={(e) => onChange({ ...value, customStart: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={value.customEnd}
            onChange={(e) => onChange({ ...value, customEnd: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  )
}

export { ScheduledFilters }
