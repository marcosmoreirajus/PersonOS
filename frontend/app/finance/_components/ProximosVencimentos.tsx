'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { formatDateBR, hojeLocal } from '@/lib/dates'

type Vencimento = {
  id: number
  description: string | null
  amount: number
  /** AAAA-MM-DD */
  due_date: string
  overdue: boolean
}

type Proximos = {
  a_pagar: Vencimento[]
  a_receber: Vencimento[]
}

const AGENDADAS = '/finance/agendadas'

function Lista({ titulo, itens }: { titulo: string; itens: Vencimento[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada por aqui.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {itens.map((v) => (
            <li key={v.id}>
              <Link
                href={AGENDADAS}
                className={
                  'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted ' +
                  (v.overdue ? 'border-l-2 border-destructive bg-destructive/10' : '')
                }
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{v.description || 'Sem descrição'}</span>
                  <span className={'text-xs ' + (v.overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                    {v.overdue ? 'Atrasado · ' : ''}
                    {formatDateBR(v.due_date)}
                  </span>
                </span>
                <MoneyValue value={v.amount} className="shrink-0 font-medium" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Próximos vencimentos: as 5 obrigações a pagar e as 5 a receber mais
 * próximas, atrasadas primeiro. A conta é do backend; "hoje" é o relógio
 * local do cliente. Carrega e falha sozinho, sem derrubar a página.
 */
export function ProximosVencimentos({ refreshKey = 0 }: { refreshKey?: number }) {
  const [dados, setDados] = useState<Proximos | null>(null)
  const [erro, setErro] = useState<string | null>(null)

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
            <CardDescription>O que vem a pagar e a receber, atrasados primeiro.</CardDescription>
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
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : vazio ? (
          <p className="text-sm text-muted-foreground">
            Nada a pagar nem a receber.{' '}
            <Link href={AGENDADAS} className="font-medium text-foreground underline underline-offset-2">
              Ir para Agendadas
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Lista titulo="A pagar" itens={dados.a_pagar} />
            <Lista titulo="A receber" itens={dados.a_receber} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
