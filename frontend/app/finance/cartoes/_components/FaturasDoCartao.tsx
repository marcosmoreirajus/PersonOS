'use client'

import { useEffect, useState } from 'react'

import { Carregando } from '@/components/ui/carregando'
import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { api } from '@/lib/api'
import { formatDateBR, hojeLocal } from '@/lib/dates'
import { rotuloDoCiclo, rotuloDoEstado, type Fatura, type FaturaDetalhe } from '@/lib/faturas'

type Categoria = { id: number; name: string }

/**
 * Faturas de um Cartão (issue #26): a lista (a mais recente primeiro) e, ao
 * abrir uma, o detalhe com as compras e o total. Tudo vem derivado do backend;
 * `hoje` do relógio local é o que decide aberta/fechada.
 */
export function FaturasDoCartao({ cardId }: { cardId: number }) {
  const [faturas, setFaturas] = useState<Fatura[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [aberta, setAberta] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api<Fatura[]>(`/api/cards/${cardId}/invoices?hoje=${hojeLocal()}`)
      .then((lista) => !cancelado && setFaturas(lista))
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível carregar as faturas.'))
    // Os nomes de categoria só enfeitam o detalhe: degradam sem derrubar a lista.
    api<Categoria[]>('/api/categories')
      .then((lista) => !cancelado && setCategorias(lista))
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [cardId])

  if (erro) return <p className="text-sm text-destructive">{erro}</p>
  if (!faturas) return <Carregando compacto rotulo="Carregando faturas" />
  if (faturas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma compra neste cartão ainda. A fatura nasce com a primeira compra.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {faturas.map((f) => (
        <li key={f.cycle} className="py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{rotuloDoCiclo(f.cycle)}</span>
              <span className="text-xs text-muted-foreground">
                {rotuloDoEstado(f.state)} · fecha {formatDateBR(f.closing_date)} · vence {formatDateBR(f.due_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex flex-col items-end">
                <MoneyValue value={f.total} className="text-sm font-medium text-foreground" />
                {f.paid > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {f.remaining > 0 ? (
                      <>
                        falta <MoneyValue value={f.remaining} />
                      </>
                    ) : (
                      'quitada'
                    )}
                  </span>
                )}
              </span>
              <Button variant="ghost" size="sm" aria-expanded={aberta === f.cycle} onClick={() => setAberta(aberta === f.cycle ? null : f.cycle)}>
                {aberta === f.cycle ? 'Ocultar' : 'Detalhe'}
              </Button>
            </div>
          </div>
          {aberta === f.cycle && <DetalheDaFatura cardId={cardId} ciclo={f.cycle} categorias={categorias} />}
        </li>
      ))}
    </ul>
  )
}

function DetalheDaFatura({ cardId, ciclo, categorias }: { cardId: number; ciclo: string; categorias: Categoria[] }) {
  const [detalhe, setDetalhe] = useState<FaturaDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api<FaturaDetalhe>(`/api/cards/${cardId}/invoices/${ciclo}?hoje=${hojeLocal()}`)
      .then((d) => !cancelado && setDetalhe(d))
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível carregar a fatura.'))
    return () => {
      cancelado = true
    }
  }, [cardId, ciclo])

  if (erro) return <p className="mt-2 text-sm text-destructive">{erro}</p>
  if (!detalhe) return <Carregando compacto rotulo="Carregando compras" />

  const nomeDaCategoria = (id: number | null) => categorias.find((c) => c.id === id)?.name ?? 'Sem categoria'

  return (
    <div className="mt-2 rounded-lg bg-muted/40 p-3">
      <ul className="flex flex-col gap-1.5 text-sm">
        {detalhe.purchases.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-foreground">{c.description || 'Compra'}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateBR(c.date)} · {nomeDaCategoria(c.category_id)}
              </span>
            </span>
            <MoneyValue value={c.amount} className="shrink-0 text-foreground" />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium text-foreground">
        <span>Total da fatura</span>
        <MoneyValue value={detalhe.total} />
      </div>
      {detalhe.payments.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-sm">
          <ul className="flex flex-col gap-1.5">
            {detalhe.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{p.description || 'Pagamento'}</span>
                  <span className="text-xs text-muted-foreground">Pagamento · {formatDateBR(p.date)}</span>
                </span>
                <span className="shrink-0 text-foreground">
                  −<MoneyValue value={p.amount} />
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Falta pagar</span>
            <MoneyValue value={detalhe.remaining} />
          </div>
        </div>
      )}
    </div>
  )
}
