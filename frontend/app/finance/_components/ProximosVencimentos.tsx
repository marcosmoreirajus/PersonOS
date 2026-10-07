'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { SkeletonLinhas } from '@/components/ui/carregando'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { formatDateBR, hojeLocal } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { VencimentoDrawer, type Vencimento, type VencimentoAberto } from './VencimentoDrawer'

type Proximos = {
  a_pagar: Vencimento[]
  a_receber: Vencimento[]
}

const AGENDADAS = '/finance/agendadas'

function Lista({
  titulo,
  tipo,
  itens,
  onOpen,
}: {
  titulo: string
  tipo: 'pagar' | 'receber'
  itens: Vencimento[]
  onOpen: (a: VencimentoAberto) => void
}) {
  const Icone = tipo === 'pagar' ? ArrowUpRight : ArrowDownLeft
  return (
    <div className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">Nada por aqui.</p>
      ) : (
        itens.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onOpen({ v, tipo })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted',
              v.overdue && 'border-l-2 border-destructive bg-destructive/10'
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background">
              <Icone className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-foreground">{v.description || 'Sem descrição'}</span>
              <span className={cn('text-xs', v.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {v.overdue ? 'Atrasado · ' : ''}
                {formatDateBR(v.due_date)}
              </span>
            </span>
            <MoneyValue value={v.amount} className="shrink-0 font-medium" />
          </button>
        ))
      )}
    </div>
  )
}

/**
 * Próximos vencimentos: as 5 obrigações a pagar e as 5 a receber mais
 * próximas, atrasadas primeiro. A conta é do backend; "hoje" é o relógio
 * local do cliente. Cada linha abre um drawer com os dados e as operações.
 * Carrega e falha sozinho, sem derrubar a página; `onChanged` avisa a página
 * quando uma operação mudou o que ela mostra.
 */
export function ProximosVencimentos({ refreshKey = 0, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const [dados, setDados] = useState<Proximos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<VencimentoAberto | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Proximos>(`/api/dashboard/${CURRENT_USER_ID}/upcoming`, { query: { hoje: hojeLocal() } })
      .then((d) => {
        if (cancelled) return
        setDados(d)
        setErro(null)
      })
      .catch((e) => {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os vencimentos.')
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const vazio = dados !== null && dados.a_pagar.length === 0 && dados.a_receber.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Próximos vencimentos</CardTitle>
            <CardDescription>Clique num item para ver os detalhes e agir.</CardDescription>
          </div>
          <Link href={AGENDADAS} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
            Ver todos ›
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {erro ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </div>
        ) : dados === null ? (
          <SkeletonLinhas />
        ) : vazio ? (
          <p className="text-sm text-muted-foreground">
            Nada a pagar nem a receber.{' '}
            <Link href={AGENDADAS} className="font-medium text-foreground underline underline-offset-2">
              Ir para Agendadas
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Lista titulo="A pagar" tipo="pagar" itens={dados.a_pagar} onOpen={setAberto} />
            <Lista titulo="A receber" tipo="receber" itens={dados.a_receber} onOpen={setAberto} />
          </div>
        )}
      </CardContent>
      <VencimentoDrawer item={aberto} onClose={() => setAberto(null)} onChanged={() => onChanged?.()} />
    </Card>
  )
}
