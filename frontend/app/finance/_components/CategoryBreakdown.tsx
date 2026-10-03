'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, MoneyValue } from '@/components/ui/money-value'

export interface CategoryDatum {
  name: string
  value: number
  color: string
  /** Torna o rótulo um link — ex.: o balde "Sem categoria" leva à fila. */
  href?: string
}

/** A fila "A revisar" filtrada só nos lançamentos sem categoria. */
export const REVISAR_SEM_CATEGORIA = '/finance/revisar?secao=sem-categoria'

/**
 * Monta os dados do gráfico com o balde virtual "Sem categoria".
 *
 * A escala de ranking é só das categorias reais; o balde entra depois, pelo
 * peso, em `--foreground` e clicável para a fila. Se o não classificado é o
 * maior, ele encabeça a lista — é isso que o gráfico precisa gritar (spec,
 * "Ambiguidades resolvidas" 2). Nunca juntar o nulo em "Outros": esse é uma
 * escolha deliberada.
 */
export function rankWithUncategorized(
  real: { name: string; value: number }[],
  uncategorized: number,
  colorByRank: (rank: number) => string
): CategoryDatum[] {
  const ranked: CategoryDatum[] = [...real]
    .sort((a, b) => b.value - a.value)
    .map((d, rank) => ({ ...d, color: colorByRank(rank) }))
  if (uncategorized <= 0) return ranked
  return [
    ...ranked,
    { name: 'Sem categoria', value: uncategorized, color: 'var(--foreground)', href: REVISAR_SEM_CATEGORIA },
  ].sort((a, b) => b.value - a.value)
}

/** Rótulo da categoria; vira link quando o dado aponta para algum lugar. */
function CategoryLabel({ d }: { d: Pick<CategoryDatum, 'name' | 'color' | 'href'> }) {
  const badge = <Badge color={d.color}>{d.name}</Badge>
  if (!d.href) return badge
  return (
    <Link href={d.href} className="rounded-full underline-offset-4 hover:underline focus-visible:outline-2">
      {badge}
    </Link>
  )
}

export type BreakdownKind = 'expense' | 'income'

export interface CategoryBreakdownProps {
  data: CategoryDatum[]
  /**
   * Opcional: passando `kind` + `onKindChange`, aparece o toggle
   * Despesas/Receitas (Visão Geral). Sem eles, o componente fica só de
   * despesas, como em Relatórios.
   */
  kind?: BreakdownKind
  onKindChange?: (kind: BreakdownKind) => void
}

type ViewMode = 'donut' | 'bars' | 'segmented'

const KIND_LABEL: Record<BreakdownKind, { toggle: string; plural: string }> = {
  expense: { toggle: 'Despesas', plural: 'despesas' },
  income: { toggle: 'Receitas', plural: 'receitas' },
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-muted p-1">
      {options.map(([mode, text]) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            value === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * "Onde o dinheiro saiu" — componente compartilhado entre Visão Geral e
 * Relatórios (mesma informação, apresentada nos dois lugares — decisão do
 * Marco em 2026-09-16 de manter esse card em ambas as telas). Na Visão Geral
 * tem também o toggle Despesas/Receitas (18/09).
 */
function CategoryBreakdown({ data, kind = 'expense', onKindChange }: CategoryBreakdownProps) {
  const [view, setView] = useState<ViewMode>('donut')
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const maxValue = Math.max(...data.map((d) => d.value), 0)
  const { plural } = KIND_LABEL[kind]

  // Formato do gráfico à esquerda, logo acima do gráfico; Despesas/Receitas
  // à direita — decisão do Marco (18/09).
  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Segmented
        label="Formato do gráfico"
        options={[
          ['donut', 'Pizza'],
          ['bars', 'Barras'],
          ['segmented', 'Segmentada'],
        ] as const}
        value={view}
        onChange={setView}
      />
      {onKindChange && (
        <Segmented
          label="Tipo de lançamento"
          options={[
            ['expense', KIND_LABEL.expense.toggle],
            ['income', KIND_LABEL.income.toggle],
          ] as const}
          value={kind}
          onChange={onKindChange}
        />
      )}
    </div>
  )

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex flex-col gap-4">
        {onKindChange && toolbar}
        <p className="text-sm text-muted-foreground">Sem {plural} registradas.</p>
      </div>
    )
  }

  // Cada fatia começa onde as anteriores somadas terminam.
  const slices: (CategoryDatum & { dash: number; offset: number; pct: number })[] = []
  let cumulative = 0
  for (const d of data) {
    const fraction = d.value / total
    slices.push({ ...d, dash: fraction * CIRCUMFERENCE, offset: -cumulative * CIRCUMFERENCE, pct: fraction * 100 })
    cumulative += fraction
  }

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {view === 'donut' && (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" width="110" height="110" role="img" aria-label={`Donut de ${plural} por categoria`}>
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
                <CategoryLabel d={s} />
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
                <CategoryLabel d={s} />
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
                <CategoryLabel d={s} />
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
