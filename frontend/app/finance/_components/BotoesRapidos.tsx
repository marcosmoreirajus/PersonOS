'use client'

import Link from 'next/link'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, FileUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Botões rápidos do topo da Visão Geral: Despesas, Entradas e Transferência
 * abrem o lançamento já no tipo certo; Importar leva à importação. Cada um tem
 * o ícone numa caixa colorida — a mesma linguagem do card de saldo (vermelho
 * saída, verde entrada, azul-acinzentado transferência, neutro importar).
 */
export function BotoesRapidos({
  onDespesa,
  onEntrada,
  onTransferencia,
}: {
  onDespesa: () => void
  onEntrada: () => void
  onTransferencia: () => void
}) {
  const botao = 'h-9 gap-2 pl-1.5 pr-3 text-foreground hover:bg-muted'
  const caixa = (cor: string) => cn('flex size-6 items-center justify-center rounded-md', cor)

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button variant="outline" className={botao} onClick={onDespesa}>
        <span className={caixa('bg-destructive/15 text-destructive')}>
          <ArrowDownToLine className="size-3.5" />
        </span>
        Despesas
      </Button>
      <Button variant="outline" className={botao} onClick={onEntrada}>
        <span className={caixa('bg-positive/15 text-positive')}>
          <ArrowUpFromLine className="size-3.5" />
        </span>
        Entradas
      </Button>
      <Button variant="outline" className={botao} onClick={onTransferencia}>
        <span className={caixa('bg-dusty-blue/15 text-dusty-blue')}>
          <ArrowLeftRight className="size-3.5" />
        </span>
        Transferência
      </Button>
      <Button variant="outline" className={botao} render={<Link href="/finance/importar" />} nativeButton={false}>
        <span className={caixa('bg-foreground/10 text-foreground')}>
          <FileUp className="size-3.5" />
        </span>
        Importar
      </Button>
    </div>
  )
}
