'use client'

import { useEffect, useState } from 'react'

import { Carregando } from '@/components/ui/carregando'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyValue } from '@/components/ui/money-value'
import { api } from '@/lib/api'
import { formatDateBR, hojeLocal } from '@/lib/dates'
import { lerTotalDigitado, type ExtratoDaFatura } from '@/lib/fatura-extrato'
import { rotuloDaParcela, rotuloDoCiclo, rotuloDoEstado, type Fatura, type FaturaDetalhe } from '@/lib/faturas'
import { REVIEW_CHANGED_EVENT } from '../../_components/FinanceTabs'

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
  // Sobe quando uma fatura é corrigida: a lista e o detalhe recarregam.
  const [versao, setVersao] = useState(0)

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
  }, [cardId, versao])

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
          {aberta === f.cycle && <DetalheDaFatura
              cardId={cardId}
              ciclo={f.cycle}
              categorias={categorias}
              versao={versao}
              aoCorrigir={() => {
                setVersao((v) => v + 1)
                // A diferença de total mexe na fila "A revisar": o contador recalcula.
                window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT))
              }}
            />}
        </li>
      ))}
    </ul>
  )
}

function DetalheDaFatura({
  cardId,
  ciclo,
  categorias,
  versao,
  aoCorrigir,
}: {
  cardId: number
  ciclo: string
  categorias: Categoria[]
  versao: number
  aoCorrigir: () => void
}) {
  const [detalhe, setDetalhe] = useState<(FaturaDetalhe & ExtratoDaFatura) | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api<FaturaDetalhe & ExtratoDaFatura>(`/api/cards/${cardId}/invoices/${ciclo}?hoje=${hojeLocal()}`)
      .then((d) => !cancelado && setDetalhe(d))
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível carregar a fatura.'))
    return () => {
      cancelado = true
    }
  }, [cardId, ciclo, versao])

  if (erro) return <p className="mt-2 text-sm text-destructive">{erro}</p>
  if (!detalhe) return <Carregando compacto rotulo="Carregando compras" />

  const nomeDaCategoria = (id: number | null) => categorias.find((c) => c.id === id)?.name ?? 'Sem categoria'

  return (
    <div className="mt-2 rounded-lg bg-muted/40 p-3">
      <ul className="flex flex-col gap-1.5 text-sm">
        {detalhe.purchases.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-foreground">
                {c.description || (c.type === 'refund' ? 'Estorno' : 'Compra')}
                {rotuloDaParcela(c) && <span className="ml-1.5 text-xs text-muted-foreground">{rotuloDaParcela(c)}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateBR(c.date)} · {nomeDaCategoria(c.category_id)}
                {c.type === 'refund' ? ' · Estorno' : ''}
                {c.predicted && ' · prevista'}
              </span>
            </span>
            {/* O estorno vem negativo da API: reduz o total da fatura. */}
            <MoneyValue value={c.amount} className="shrink-0 text-foreground" />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium text-foreground">
        <span>Total da fatura</span>
        <MoneyValue value={detalhe.total} />
      </div>
      {detalhe.declared_total !== null && detalhe.difference !== 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {detalhe.total_decision === 'extract' ? 'Total do extrato adotado' : 'Extrato diz'}{' '}
          <MoneyValue value={detalhe.declared_total} />; soma das compras <MoneyValue value={detalhe.purchases_total} />.
        </p>
      )}
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
      <EditorDaFatura key={`${detalhe.closing_date}|${detalhe.due_date}|${detalhe.declared_total}`} cardId={cardId} detalhe={detalhe} aoCorrigir={aoCorrigir} />
    </div>
  )
}

/**
 * Fechamento, vencimento e total do extrato, editáveis à mão (issue #28).
 * Vazio apaga a correção: fechamento e vencimento voltam ao calculado e o
 * total do extrato deixa de existir. O arquivo OFX preenche os mesmos campos.
 */
function EditorDaFatura({
  cardId,
  detalhe,
  aoCorrigir,
}: {
  cardId: number
  detalhe: FaturaDetalhe & ExtratoDaFatura
  aoCorrigir: () => void
}) {
  const [fechamento, setFechamento] = useState(detalhe.closing_date)
  const [vencimento, setVencimento] = useState(detalhe.due_date)
  const [total, setTotal] = useState(detalhe.declared_total === null ? '' : String(detalhe.declared_total))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const t = lerTotalDigitado(total)
    if (!t.valido) {
      setErro('Informe o total da fatura como um número, sem negativo.')
      return
    }
    // Só o que mudou: mandar o que não mexeu fixaria como "à mão" um valor lido do arquivo.
    const body: Record<string, string | number | null> = {}
    if (fechamento !== detalhe.closing_date) body.closing_date = fechamento || null
    if (vencimento !== detalhe.due_date) body.due_date = vencimento || null
    if (t.valor !== detalhe.declared_total) body.declared_total = t.valor
    if (Object.keys(body).length === 0) {
      setErro(null)
      return
    }
    setSalvando(true)
    try {
      await api(`/api/cards/${cardId}/invoices/${detalhe.cycle}?hoje=${hojeLocal()}`, { method: 'PATCH', body })
      setErro(null)
      aoCorrigir()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a fatura.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
      <p className="text-xs text-muted-foreground">
        Corrija com o que o banco informou. Se o total do extrato for diferente da soma das compras, a diferença vai para &quot;A revisar&quot;.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Fechamento
          <Input type="date" value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Vencimento
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Total do extrato (R$)
          <Input inputMode="decimal" placeholder="sem total declarado" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div>
        <Button size="sm" disabled={salvando} onClick={salvar}>
          Salvar correção
        </Button>
      </div>
    </div>
  )
}
