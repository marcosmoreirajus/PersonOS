'use client'

import { Eye, CheckCircle2, SkipForward, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { MoneyValue } from '@/components/ui/money-value'
import { ActionsMenu, type ActionsMenuAction } from '@/components/ui/actions-menu'
import { cn } from '@/lib/utils'
import { TYPE_META, effectiveStatus, type ScheduledItem } from './types'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export interface UpcomingListProps {
  items: ScheduledItem[]
}

function UpcomingList({ items }: UpcomingListProps) {
  const today = new Date()
  const sorted = [...items].sort((a, b) => a.due_date.localeCompare(b.due_date))

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada no período/filtro selecionado.</p>
  }

  return (
    <ul className="flex flex-col">
      {sorted.map((item) => {
        const status = effectiveStatus(item, today)
        const meta = TYPE_META[item.type]

        const actions: ActionsMenuAction[] = [
          { key: 'details', label: 'Ver detalhes', icon: Eye, onSelect: () => {} },
          ...(status !== 'paid'
            ? [{ key: 'pay', label: 'Pagar', icon: CheckCircle2, onSelect: () => {} }]
            : []),
          ...(item.type !== 'conta_fixa' && status !== 'paid'
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
                  {status === 'paid' ? 'Pago em' : 'Vence'} {formatDate(item.due_date)}
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground"><MoneyValue value={item.value} /></span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge color={meta.color} icon={meta.icon}>
                  {meta.label}
                </Badge>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {status === 'overdue' ? 'Em atraso' : status === 'paid' ? 'Pago' : 'A vencer'}
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
