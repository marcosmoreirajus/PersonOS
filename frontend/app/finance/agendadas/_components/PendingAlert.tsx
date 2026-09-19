'use client'

import { CircleAlert } from 'lucide-react'

import { MoneyValue } from '@/components/ui/money-value'
import type { PendingSummary } from './types'

export interface PendingAlertProps {
  summary: PendingSummary
  month: Date
}

/**
 * Um único alerta com tudo que está pendente no mês (contas a pagar +
 * receitas a receber), mostrado no tooltip de cada mês da MonthStrip — pedido do
 * Marco (18/09): um alerta só, não uma lista. Quando existir conciliação
 * (depende de importação OFX/Open Finance), entra aqui como mais uma linha.
 */
function PendingAlert({ summary, month }: PendingAlertProps) {
  const { toPay, toReceive, overdueCount } = summary
  if (toPay.count === 0 && toReceive.count === 0) return null

  const monthName = month.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <div role="status" className="flex gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-foreground">Pendências em {monthName}</span>
        {toPay.count > 0 && (
          <span className="text-secondary-foreground">
            {toPay.count} {toPay.count === 1 ? 'conta a pagar' : 'contas a pagar'} ·{' '}
            <MoneyValue value={toPay.total} className="whitespace-nowrap" />
          </span>
        )}
        {toReceive.count > 0 && (
          <span className="text-secondary-foreground">
            {toReceive.count} {toReceive.count === 1 ? 'receita a receber' : 'receitas a receber'} ·{' '}
            <MoneyValue value={toReceive.total} className="whitespace-nowrap" />
          </span>
        )}
        {overdueCount > 0 && (
          <span className="font-medium text-destructive">
            {overdueCount} em atraso
          </span>
        )}
      </div>
    </div>
  )
}

export { PendingAlert }
