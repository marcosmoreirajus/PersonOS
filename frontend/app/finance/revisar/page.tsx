'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { Carregando } from '@/components/ui/carregando'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoryPicker, categoriasDoTipo, type PickerCategory } from '../_components/CategoryPicker'
import { REVIEW_CHANGED_EVENT } from '../_components/FinanceTabs'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { chaveDaFatura, lerChave, type OpcoesDePagamento } from '@/lib/pagamento-fatura'
import { SeletorDeFatura } from '../_components/SeletorDeFatura'
import { formatDateBR } from '@/lib/dates'

type Lancamento = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string
  due_date: string
  settled_at: string | null
}

type Candidato = Pick<Lancamento, 'id' | 'description' | 'amount' | 'due_date' | 'settled_at'>

type Fila = {
  a_conciliar: (Lancamento & { candidato: Candidato | null })[]
  /** Saídas da conta que parecem pagar uma fatura (#29), com as faturas possíveis. */
  pagamentos_fatura: (Lancamento & OpcoesDePagamento)[]
  sem_categoria: Lancamento[]
  total: number
}

/** Seções que um link pode pedir sozinhas — ex.: o balde de Relatórios. */
type Secao = 'conciliar' | 'pagamentos' | 'sem-categoria'

function Valor({ t }: { t: Pick<Lancamento, 'type' | 'amount'> }) {
  return (
    <>
      {t.type === 'income' ? '+' : '−'}
      <MoneyValue value={t.amount} />
    </>
  )
}

/**
 * "A revisar" — a fila do que falta resolver (Fatia 4).
 *
 * Duas seções: linhas importadas que parecem duplicar um lançamento e
 * esperam decisão, e lançamentos sem categoria. É fila de classificação,
 * não aviso de prazo — ver GLOSSARY.md. Cada item resolvido sai da lista na
 * hora; a aba do topo recontará pelo evento.
 */
function Revisar() {
  // Valor desconhecido na URL mostra a fila inteira, em vez de esconder tudo.
  const pedida = useSearchParams().get('secao')
  const secao: Secao | null =
    pedida === 'conciliar' || pedida === 'pagamentos' || pedida === 'sem-categoria' ? pedida : null
  const [fila, setFila] = useState<Fila | null>(null)
  const [categories, setCategories] = useState<PickerCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  // Fatura escolhida por linha; sem escolha vale a padrão que o backend sugeriu.
  const [faturaEscolhida, setFaturaEscolhida] = useState<Record<number, string>>({})

  const carregar = useCallback(async () => {
    const [fila, cats] = await Promise.all([
      // A fila propaga o erro: sem isso, um 404 (ex.: backend desatualizado)
      // deixava a fila indefinida e a tela presa em "Carregando..." para sempre.
      api<Fila>(`/api/review/user/${CURRENT_USER_ID}`),
      // As categorias degradam em vez de derrubar a tela — a fila é o que
      // importa aqui, e ela carrega sozinha.
      api<PickerCategory[]>('/api/categories').catch(() => []),
    ])
    setFila(fila)
    setCategories(cats)
    setError(null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados: o setState vem depois do await (o lint não enxerga dentro do useCallback async)
    carregar().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar a fila.'))
  }, [carregar])

  async function resolver(id: number, req: () => Promise<unknown>) {
    setOcupado(id)
    try {
      await req()
      setError(null)
      await carregar()
      window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setOcupado(null)
    }
  }

  const conciliar = (id: number, action: 'merge' | 'not_duplicate') =>
    resolver(id, () => api(`/api/reconcile/${id}`, { method: 'POST', body: { action } }))

  const confirmarPagamento = (id: number, chave: string) => {
    const fatura = lerChave(chave)
    if (fatura) resolver(id, () => api(`/api/invoice-payments/${id}`, { method: 'POST', body: fatura }))
  }

  const recusarPagamento = (id: number) => resolver(id, () => api(`/api/invoice-payments/${id}/reject`, { method: 'POST' }))

  const categorizar = (id: number, categoryId: string) =>
    resolver(id, () => api(`/api/transactions/${id}`, { method: 'PATCH', body: { category_id: Number(categoryId), scope: 'only_this' } }))

  if (!fila) {
    return error ? <Erro texto={error} /> : <Carregando />
  }

  const mostrar = (s: Secao) => !secao || secao === s

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-foreground">A revisar</h1>
        {secao && (
          <Link href="/finance/revisar" className="text-sm text-muted-foreground hover:text-foreground">
            Ver a fila inteira ({fila.total})
          </Link>
        )}
      </div>

      {error && <Erro texto={error} />}

      {fila.total === 0 && !secao && (
        <p className="text-sm text-muted-foreground">Nada a revisar. Tudo conciliado e categorizado.</p>
      )}

      {mostrar('conciliar') && (fila.a_conciliar.length > 0 || secao === 'conciliar') && (
        <Card>
          <CardHeader>
            <CardTitle>Aguardando conciliação</CardTitle>
            <CardDescription>
              Linhas importadas que parecem duplicar um lançamento. Ficam fora do saldo e dos relatórios até você decidir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fila.a_conciliar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma linha aguardando conciliação.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Do extrato</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Decisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.a_conciliar.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums">{formatDateBR(t.settled_at ?? t.due_date)}</TableCell>
                      <TableCell className="max-w-[22rem]">
                        <span className="block truncate">{t.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.candidato ? (
                            <>
                              Parece com: {t.candidato.description} · {formatDateBR(t.candidato.settled_at ?? t.candidato.due_date)} ·{' '}
                              <MoneyValue value={t.candidato.amount} />
                            </>
                          ) : (
                            'O lançamento parecido não existe mais.'
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Valor t={t} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {t.candidato && (
                            <Button size="sm" disabled={ocupado === t.id} onClick={() => conciliar(t.id, 'merge')}>
                              É o mesmo
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={ocupado === t.id}
                            onClick={() => conciliar(t.id, 'not_duplicate')}
                          >
                            Não é duplicata
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {mostrar('pagamentos') && (fila.pagamentos_fatura.length > 0 || secao === 'pagamentos') && (
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos de fatura</CardTitle>
            <CardDescription>
              Saídas da conta que parecem pagar a fatura de um cartão. Ficam fora do saldo e dos relatórios até você decidir: confirmar
              abate a fatura (o valor pago é o da saída); recusar devolve a linha como despesa comum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fila.pagamentos_fatura.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento de fatura esperando decisão.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Da conta</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Decisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.pagamentos_fatura.map((t) => {
                    const escolha = faturaEscolhida[t.id] ?? (t.padrao ? chaveDaFatura(t.padrao) : null)
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="tabular-nums">{formatDateBR(t.settled_at ?? t.due_date)}</TableCell>
                        <TableCell className="max-w-[16rem]">
                          <span className="block truncate">{t.description}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Valor t={t} />
                        </TableCell>
                        <TableCell>
                          {t.opcoes.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Nenhuma fatura a pagar nesta data.</span>
                          ) : (
                            <SeletorDeFatura
                              opcoes={t.opcoes}
                              value={escolha}
                              onChange={(v) => setFaturaEscolhida((e) => ({ ...e, [t.id]: v }))}
                              rotulo={`Fatura paga por ${t.description}`}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" disabled={ocupado === t.id || !escolha} onClick={() => escolha && confirmarPagamento(t.id, escolha)}>
                              É pagamento
                            </Button>
                            <Button size="sm" variant="outline" disabled={ocupado === t.id} onClick={() => recusarPagamento(t.id)}>
                              Não é
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {mostrar('sem-categoria') && (fila.sem_categoria.length > 0 || secao === 'sem-categoria') && (
        <Card>
          <CardHeader>
            <CardTitle>Sem categoria</CardTitle>
            <CardDescription>
              Lançamentos já efetivados. Aparecem nos relatórios no balde &quot;Sem categoria&quot; até serem classificados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fila.sem_categoria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os lançamentos têm categoria.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.sem_categoria.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums">{formatDateBR(t.settled_at ?? t.due_date)}</TableCell>
                      <TableCell className="max-w-[22rem]">
                        <span className="block truncate">{t.description}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Valor t={t} />
                      </TableCell>
                      <TableCell className="w-64">
                        <CategoryPicker
                          categories={categoriasDoTipo(categories, t.type)}
                          value=""
                          onChange={(v) => v && categorizar(t.id, v)}
                          placeholder="Escolher categoria..."
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Erro({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{texto}</div>
  )
}

// `useSearchParams` precisa de um limite de Suspense para a página poder ser
// pré-renderizada no build.
export default function RevisarPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Revisar />
    </Suspense>
  )
}
