'use client'

import type { ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { ListFilter, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { NATURE_LABEL, type CategoryMeta, type ScheduledNature } from './types'

export interface ScheduledFiltersValue {
  categoryId: number | 'all'
  nature: ScheduledNature | 'all'
}

export const EMPTY_FILTERS: ScheduledFiltersValue = { categoryId: 'all', nature: 'all' }

export interface ScheduledFiltersProps {
  value: ScheduledFiltersValue
  onChange: (value: ScheduledFiltersValue) => void
  /** Só as categorias que têm item no mês, já na ordem do ranking. */
  categoryMeta: Map<number, CategoryMeta>
}

function OptionPill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-secondary-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Categoria e Natureza num único botão "Filtrar" (popover), em vez de uma
 * fileira de segmented control por eixo — decisão de 2026-09-18: a lista de
 * categorias cresce e não cabe numa fileira, e o período já é o MonthPicker
 * do topo. Filtros ativos aparecem como chips removíveis + "Limpar" à ESQUERDA
 * do botão — o botão fica sempre no mesmo lugar (pedido do Marco, 18/09).
 */
function ScheduledFilters({ value, onChange, categoryMeta }: ScheduledFiltersProps) {
  const activeCount = (value.categoryId !== 'all' ? 1 : 0) + (value.nature !== 'all' ? 1 : 0)
  const activeCategory = value.categoryId !== 'all' ? categoryMeta.get(value.categoryId) : undefined

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {activeCategory && (
        <ActiveChip label={activeCategory.name} onRemove={() => onChange({ ...value, categoryId: 'all' })} />
      )}
      {value.nature !== 'all' && (
        <ActiveChip label={NATURE_LABEL[value.nature]} onRemove={() => onChange({ ...value, nature: 'all' })} />
      )}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="px-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}

      <Popover.Root>
        <Popover.Trigger className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-shadow hover:shadow-md">
          <ListFilter className="size-4 text-muted-foreground" aria-hidden="true" />
          Filtrar
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
              {activeCount}
            </span>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align="end">
            <Popover.Popup className="flex w-72 flex-col gap-4 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none">
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</h3>
                <div className="flex flex-wrap gap-1.5">
                  <OptionPill selected={value.categoryId === 'all'} onClick={() => onChange({ ...value, categoryId: 'all' })}>
                    Todas
                  </OptionPill>
                  {[...categoryMeta.entries()].map(([id, meta]) => (
                    <OptionPill key={id} selected={value.categoryId === id} onClick={() => onChange({ ...value, categoryId: id })}>
                      {meta.name}
                    </OptionPill>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Natureza</h3>
                <div className="flex flex-wrap gap-1.5">
                  <OptionPill selected={value.nature === 'all'} onClick={() => onChange({ ...value, nature: 'all' })}>
                    Todas
                  </OptionPill>
                  {(Object.entries(NATURE_LABEL) as [ScheduledNature, string][]).map(([nature, label]) => (
                    <OptionPill key={nature} selected={value.nature === nature} onClick={() => onChange({ ...value, nature })}>
                      {label}
                    </OptionPill>
                  ))}
                </div>
              </section>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

    </div>
  )
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pr-1 pl-2.5 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

export { ScheduledFilters }
