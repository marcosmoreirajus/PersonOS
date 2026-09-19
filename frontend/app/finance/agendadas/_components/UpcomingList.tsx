'use client'

import { Eye, CheckCircle2, SkipForward, Pencil, HandCoins } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { MoneyValue } from '@/components/ui/money-value'
import { ActionsMenu, type ActionsMenuAction } from '@/components/ui/actions-menu'
import { cn } from '@/lib/utils'
import { effectiveStatus, natureMeta, type CategoryMeta, type ScheduledItem } from './types'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export interface UpcomingListProps {
  items: ScheduledItem[]
  categoryMeta: Map<number, CategoryMeta>
}

function UpcomingList({ items, categoryMeta }: UpcomingListProps) {
  const today = new Date()
  const sorted = [...items].sort((a, b) => a.due_date.localeCompare(b.due_date))

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada no período/filtro selecionado.</p>
  }

  return (
    <ul className="flex flex-col">
      {sorted.map((item) => {
        const status = effectiveStatus(item, today)
        const category = categoryMeta.get(item.category_id)
        const nature = natureMeta(item)
        const isIncome = item.type === 'income'

        const actions: ActionsMenuAction[] = [
          { key: 'details', label: 'Ver detalhes', icon: Eye, onSelect: () => {} },
          ...(status !== 'paid'
            ? [
                isIncome
                  ? { key: 'receive', label: 'Receber', icon: HandCoins, onSelect: () => {} }
                  : { key: 'pay', label: 'Pagar', icon: CheckCircle2, onSelect: () => {} },
              ]
            : []),
          // Pular = adiar esta ocorrência; só faz sentido quando há uma próxima.
          ...(item.nature !== 'a_vista' && status !== 'paid'
            ? [{ key: 'skip', label: 'Pular', icon: SkipForward, onSelect: () => {} }]
            : []),
          ...(status !== 'paid'
            ? [{ key: 'edit', label: 'Editar', icon: Pencil, onSelect: () => {} }]
            : []),
        ]

        return (
          <li key={item.id} className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {status === 'paid' ? (isIncome ? 'Recebido em' : 'Pago em') : isIncome ? 'Previsto para' : 'Vence'}{' '}
                  {formatDate(item.due_date)}
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">
                {isIncome && '+'}
                <MoneyValue value={item.value} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge color={category?.color}>{category?.name ?? 'Outros'}</Badge>
                <Badge color="var(--muted-foreground)" icon={nature.icon}>
                  {nature.label}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {status === 'overdue'
                    ? 'Em atraso'
                    : status === 'paid'
                      ? isIncome
                        ? 'Recebido'
                        : 'Pago'
                      : isIncome
                        ? 'A receber'
                        : 'A vencer'}
                </span>
              </div>
              <ActionsMenu actions={actions} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export { UpcomingList }
