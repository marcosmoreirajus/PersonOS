'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { SkeletonLinhas } from '@/components/ui/carregando'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { hojeLocal } from '@/lib/dates'
import { hrefLancamento } from '@/lib/relatorios-gastos'
import { agruparPorDia } from '@/lib/ultimas'
import { REVISAR_SEM_CATEGORIA } from './CategoryBreakdown'

type Ultima = {
  id: number
  description: string | null
  amount: number
  /** `refund` é o estorno no cartão (#31): rótulo próprio, nunca receita. */
  type: 'income' | 'expense' | 'refund'
  /** AAAA-MM-DD do dia em que efetivou. */
  day: string
  /** Nulo = "Sem categoria". */
  category_id: number | null
  account_name: string | null
  is_internal_transfer: boolean
  imported: boolean
}

type Category = { id: number; name: string }

const TRANSACOES = '/finance/transactions'

function Marca({ children }: { children: string }) {
  return (
    <span className="rounded border border-border px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

/**
 * Últimas transações: os 8 últimos efetivados, agrupados por dia. A lista vem
 * pronta do backend; "Hoje" e "Ontem" são do relógio local do cliente. Cada
 * linha abre o lançamento para editar. Carrega e falha sozinho, sem derrubar a
 * página. `onNovo` abre o cadastro de lançamento, que mora na página.
 */
export function UltimasTransacoes({ refreshKey = 0, onNovo }: { refreshKey?: number; onNovo: () => void }) {
  const [itens, setItens] = useState<Ultima[] | null>(null)
  const [nomes, setNomes] = useState<Map<number, string>>(new Map())
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<Ultima[]>(`/api/dashboard/${CURRENT_USER_ID}/recent`),
      api<Category[]>('/api/categories'),
    ])
      .then(([lista, cats]) => {
        if (cancelled) return
        setItens(lista)
        setNomes(new Map(cats.map((c) => [c.id, c.name])))
        setErro(null)
      })
      .catch((e) => {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as últimas transações.')
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Últimas transações</CardTitle>
            <CardDescription>Os 8 últimos lançamentos efetivados.</CardDescription>
          </div>
          <Link href={TRANSACOES} className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
            Ver todas ›
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {erro ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </div>
        ) : itens === null ? (
          <SkeletonLinhas />
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            <Button variant="outline" size="sm" onClick={onNovo}>
              Novo lançamento
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {agruparPorDia(itens, hojeLocal()).map((grupo) => (
              <div key={grupo.dia} className="flex flex-col gap-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{grupo.rotulo}</h3>
                <ul className="flex flex-col gap-1">
                  {grupo.itens.map((t) => (
                    <li
                      key={t.id}
                      className="relative flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      {/* Link esticado sobre a linha: o de "Sem categoria" fica por cima (link dentro de link não vale). */}
                      <Link href={hrefLancamento(t.id)} aria-label={`Editar ${t.description || 'lançamento'}`} className="absolute inset-0 rounded-md" />
                      <span className="pointer-events-none flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-foreground">{t.description || 'Sem descrição'}</span>
                          {t.is_internal_transfer && <Marca>Transferência</Marca>}
                          {t.imported && <Marca>Importado</Marca>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t.category_id === null ? (
                            <Link
                              href={REVISAR_SEM_CATEGORIA}
                              className="pointer-events-auto relative underline underline-offset-2 hover:text-foreground"
                            >
                              Sem categoria
                            </Link>
                          ) : (
                            (nomes.get(t.category_id) ?? 'Categoria removida')
                          )}
                          {t.account_name ? ` · ${t.account_name}` : ''}
                        </span>
                      </span>
                      <span
                        className={
                          'pointer-events-none shrink-0 font-medium ' +
                          (t.is_internal_transfer
                            ? 'text-muted-foreground'
                            : t.type !== 'expense'
                              ? 'text-foreground'
                              : 'text-destructive')
                        }
                      >
                        {t.type === 'refund' && <span className="mr-1 text-xs font-normal text-muted-foreground">Estorno</span>}
                        {t.type === 'expense' ? '-' : '+'}
                        <MoneyValue value={t.amount} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
