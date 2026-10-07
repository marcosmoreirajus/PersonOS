import { Pencil } from 'lucide-react'

import { TiltCard } from '@/components/motion/tilt-card'
import { MoneyValue } from '@/components/ui/money-value'
import { cn } from '@/lib/utils'
import { LogoConta } from './LogoConta'
import { rotuloTipo, type Saldos } from './useContas'
import type { Conta } from '../importar/_components/NovaContaDialog'

/**
 * Cartão azul de uma conta cadastrada (token `--card-tint`): selo, nome, tipo
 * (e "Fora do Saldo Geral" quando marcada) e o saldo grande, com a inclinação
 * (`TiltCard`) que todos os tiles de conta e cartão compartilham. Com
 * `onEditar` (página Contas e cartões) o tile inteiro é o botão que abre a
 * edição; sem ele (Visão Geral) é só visual — quem o torna clicável é o link
 * em volta, que leva à página completa.
 */
export function TileConta({
  linha,
  completa,
  onEditar,
  className,
}: {
  linha: Saldos['accounts'][number]
  completa: Conta | undefined
  onEditar?: (c: Conta) => void
  className?: string
}) {
  return (
    <TiltCard className={cn('bg-card-tint', className)}>
      {/* Um único botão cobre o tile; o conteúdo fica por cima sem receber clique. */}
      {onEditar && completa && (
        <button
          type="button"
          aria-label={`Editar ${linha.name}`}
          onClick={() => onEditar(completa)}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      <div className="pointer-events-none flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <LogoConta logo={completa?.logo} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{linha.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {rotuloTipo(linha.kind)}
              {linha.exclude_from_total ? ' · Fora do Saldo Geral' : ''}
            </span>
          </div>
          {onEditar && <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        </div>
        <MoneyValue value={linha.balance} className="text-xl font-bold" />
      </div>
    </TiltCard>
  )
}
