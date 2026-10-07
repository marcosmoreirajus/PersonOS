import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'

import { MoneyValue } from '@/components/ui/money-value'
import { cn } from '@/lib/utils'

/**
 * Card de saldo da Visão Geral: o saldo grande (vem da API, não é refeito
 * aqui) e, embaixo, o que entrou, o que saiu e o resultado do período.
 */
export function HeroSaldo({
  saldo,
  income,
  expense,
  balance,
  className,
}: {
  saldo: number
  income: number
  expense: number
  balance: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-6', className)}>
      <span className="text-base text-muted-foreground">Saldo</span>
      <div className="text-4xl font-bold text-foreground">
        <MoneyValue value={saldo} />
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-positive/15 text-positive">
            <ArrowUpRight className="size-4" />
          </span>
          <div className="flex flex-col text-sm">
            <MoneyValue value={income} className="font-semibold" />
            <span className="text-[11px] text-muted-foreground">Entradas</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <ArrowDownLeft className="size-4" />
          </span>
          <div className="flex flex-col text-sm">
            <MoneyValue value={expense} className="font-semibold" />
            <span className="text-[11px] text-muted-foreground">Saídas</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-dusty-blue/15 text-dusty-blue">
            {balance >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </span>
          <div className="flex flex-col text-sm">
            <MoneyValue value={balance} className="font-semibold" />
            <span className="text-[11px] text-muted-foreground">Resultado</span>
          </div>
        </div>
      </div>
    </div>
  )
}
