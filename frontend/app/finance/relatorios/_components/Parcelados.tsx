'use client'

import { useEffect, useState } from 'react'

import { SkeletonLinhas } from '@/components/ui/carregando'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { formatDateBR } from '@/lib/dates'
import { mesAno } from '@/lib/relatorios-parcelados'
import { cn } from '@/lib/utils'

type Parcelado = {
  series_id: number
  description: string
  total: number
  parcela: number
  realizadas: number
  restantes: number
  falta: number
  /** `AAAA-MM-DD` da próxima parcela em aberto; nulo quando quitado. */
  proxima: string | null
  proxima_atrasada: boolean
  /** `AAAA-MM-DD` da última parcela. */
  termino: string
  quitado: boolean
}

/** Resposta de `GET /api/reports/installments/{id}` (ver docs/finance/spec.md). */
type RespostaParcelados = { parcelados: Parcelado[]; total_comprometido: number }

/**
 * Aba Parcelados: cada compra parcelada com total, parcela, realizadas e
 * restantes, o que falta, a próxima parcela e o mês de término. Independe do
 * período da tela. Ativos por padrão; o interruptor inclui os quitados.
 * "Realizadas" conta parcela efetivada, não fatura paga. O Cartão da linha
 * entra com a Fatia 5 (ticket #35), como uma coluna a mais.
 */
export function Parcelados({ hoje }: { hoje: string }) {
  const [incluirQuitados, setIncluirQuitados] = useState(false)
  // A resposta leva a chave do pedido: se a chave atual é outra, ainda está
  // carregando (sem setState dentro do efeito).
  const chave = String(incluirQuitados)
  const [resposta, setResposta] = useState<{ chave: string; dados: RespostaParcelados | null; erro: string | null } | null>(null)
  const atual = resposta?.chave === chave ? resposta : null

  useEffect(() => {
    let cancelled = false
    api<RespostaParcelados>(`/api/reports/installments/${CURRENT_USER_ID}`, {
      query: { hoje, incluir_quitados: String(incluirQuitados) },
    })
      .then((dados) => {
        if (!cancelled) setResposta({ chave, dados, erro: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResposta({ chave, dados: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar os parcelados.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [hoje, incluirQuitados, chave])

  let corpo
  if (!atual) {
    corpo = <SkeletonLinhas />
  } else if (atual.erro || !atual.dados) {
    corpo = (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {atual.erro || 'Nenhum dado disponível.'}
      </div>
    )
  } else if (atual.dados.parcelados.length === 0) {
    corpo = (
      <p className="text-sm text-muted-foreground">
        {incluirQuitados ? 'Nenhuma compra parcelada.' : 'Nenhuma compra parcelada em andamento.'}
      </p>
    )
  } else {
    const { parcelados, total_comprometido } = atual.dados
    corpo = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Compra</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Parcela</TableHead>
            <TableHead className="text-right">Realizadas</TableHead>
            <TableHead className="text-right">Restantes</TableHead>
            <TableHead className="text-right">Falta pagar</TableHead>
            <TableHead>Próxima</TableHead>
            <TableHead>Término</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parcelados.map((p) => (
            <TableRow key={p.series_id}>
              <TableCell className="max-w-[16rem] truncate font-medium">{p.description}</TableCell>
              <TableCell className="text-right tabular-nums">
                <MoneyValue value={p.total} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <MoneyValue value={p.parcela} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.realizadas}</TableCell>
              <TableCell className="text-right tabular-nums">{p.restantes}</TableCell>
              <TableCell className="text-right tabular-nums">
                <MoneyValue value={p.falta} />
              </TableCell>
              <TableCell className={cn('tabular-nums', p.proxima_atrasada && 'text-destructive')}>
                {p.proxima ? (
                  <>
                    {formatDateBR(p.proxima)}
                    {p.proxima_atrasada && <span className="ml-1 text-xs">em atraso</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">Quitado</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{mesAno(p.termino)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="font-medium">
              Total comprometido
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              <MoneyValue value={total_comprometido} />
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableFooter>
      </Table>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcelados</CardTitle>
        <CardDescription>
          Compras parceladas e o que falta pagar. &quot;Realizadas&quot; são as parcelas efetivadas. Não depende do período escolhido.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={incluirQuitados}
          onClick={() => setIncluirQuitados((v) => !v)}
          className="inline-flex items-center gap-2 self-start text-sm text-foreground"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-5 w-9 items-center rounded-full border border-border px-0.5 transition-colors',
              incluirQuitados ? 'justify-end bg-foreground' : 'justify-start bg-muted'
            )}
          >
            <span className={cn('size-4 rounded-full', incluirQuitados ? 'bg-background' : 'bg-muted-foreground')} />
          </span>
          Incluir quitados
        </button>
        {corpo}
      </CardContent>
    </Card>
  )
}
