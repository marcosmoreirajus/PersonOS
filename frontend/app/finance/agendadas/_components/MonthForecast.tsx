'use client'

import { MoneyValue } from '@/components/ui/money-value'
import type { MonthForecast as MonthForecastData } from './types'

export interface MonthForecastProps {
  forecast: MonthForecastData
}

/**
 * Previsibilidade do mês no topo do calendário: quanto entra, quanto sai e o
 * saldo previsto, com o quanto já foi quitado. Calculado sobre o mês inteiro,
 * sem os filtros — é a visão do mês, não da seleção.
 */
function MonthForecast({ forecast }: MonthForecastProps) {
  const { income, expense, balance } = forecast

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Entradas previstas</span>
        <span className="text-lg font-medium text-foreground">
          +<MoneyValue value={income.total} />
        </span>
        <span className="text-[11px] text-muted-foreground">
          <MoneyValue value={income.done} /> já recebido
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Saídas previstas</span>
        <span className="text-lg font-medium text-foreground">
          −<MoneyValue value={expense.total} />
        </span>
        <span className="text-[11px] text-muted-foreground">
          <MoneyValue value={expense.done} /> já pago
          {expense.invoices > 0 && (
            <>
              {' · '}
              <MoneyValue value={expense.invoices} /> em faturas
            </>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 sm:border-l sm:border-border sm:pl-4">
        <span className="text-xs text-muted-foreground">Saldo previsto do mês</span>
        <span className={balance < 0 ? 'text-lg font-semibold text-destructive' : 'text-lg font-semibold text-foreground'}>
          {balance < 0 ? '−' : '+'}
          <MoneyValue value={Math.abs(balance)} />
        </span>
        <span className="text-[11px] text-muted-foreground">entradas menos saídas</span>
      </div>
    </div>
  )
}

export { MonthForecast }
