'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { formatDateBR } from '@/lib/dates'
import { hrefLancamento } from '@/lib/relatorios-gastos'
import type { PeriodoEscolhido } from '@/lib/relatorios-periodo'

type Gasto = {
  id: number
  description: string
  amount: number
  settled_at: string
  category_id: number | null
  category_name: string | null
}

/** Resposta de `GET /api/reports/top-expenses/{id}` (ver docs/finance/spec.md). */
type RespostaGastos = { gastos: Gasto[] }

/**
 * Os maiores lançamentos de despesa do período escolhido. Cada linha abre o
 * lançamento em Transações. O pedido espera o período pronto (`chave`), sem
 * setState dentro do efeito.
 */
export function MaioresGastos({ periodo, hoje, pronto }: { periodo: PeriodoEscolhido; hoje: string; pronto: boolean }) {
  const chave = `${periodo.atalho}|${periodo.de}|${periodo.ate}`
  const [resposta, setResposta] = useState<{ chave: string; dados: RespostaGastos | null; erro: string | null } | null>(null)
  const atual = resposta?.chave === chave ? resposta : null

  useEffect(() => {
    if (!pronto) return
    let cancelled = false
    api<RespostaGastos>(`/api/reports/top-expenses/${CURRENT_USER_ID}`, {
      query: { periodo: periodo.atalho, hoje, de: periodo.de, ate: periodo.ate },
    })
      .then((dados) => {
        if (!cancelled) setResposta({ chave, dados, erro: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResposta({ chave, dados: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar os maiores gastos.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [periodo, hoje, pronto, chave])

  let corpo
  if (!pronto) {
    corpo = <p className="text-sm text-muted-foreground">Escolha a data inicial e a final.</p>
  } else if (!atual) {
    corpo = <p className="text-muted-foreground">Carregando...</p>
  } else if (atual.erro || !atual.dados) {
    corpo = (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {atual.erro || 'Nenhum dado disponível.'}
      </div>
    )
  } else if (atual.dados.gastos.length === 0) {
    corpo = <p className="text-sm text-muted-foreground">Sem despesas neste período.</p>
  } else {
    corpo = (
      <ul className="flex flex-col divide-y divide-border">
        {atual.dados.gastos.map((g) => (
          <li key={g.id}>
            <Link href={hrefLancamento(g.id)} className="flex items-center justify-between gap-4 py-2 hover:bg-muted">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{g.description}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateBR(g.settled_at)} · {g.category_name ?? 'Sem categoria'}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-foreground">
                <MoneyValue value={g.amount} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maiores gastos</CardTitle>
        <CardDescription>Os maiores lançamentos de despesa do período. Clique para abrir o lançamento.</CardDescription>
      </CardHeader>
      <CardContent>{corpo}</CardContent>
    </Card>
  )
}
