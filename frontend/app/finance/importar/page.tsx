'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleAlert, Download, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_USER_ID, api, apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { FileDropzone } from './_components/FileDropzone'
import { NovaContaDialog, TIPOS_CONTA, type Conta } from './_components/NovaContaDialog'
import { Steps } from './_components/Steps'
import { formatDateBR } from '@/lib/dates'

const PASSOS = ['Origem', 'Revisar', 'Confirmar']

type Situacao = 'nova' | 'ja_importada' | 'suspeita' | 'tratada_depois' | 'pagamento_fatura'
type Decisao = 'merge' | 'not_duplicate' | 'queue'

type LinhaPrevia = {
  linha: number
  data: string
  descricao: string
  valor: number
  situacao: Situacao
  import_hash: string
  candidato?: { id: number; descricao: string | null; data: string }
}

type Previa = {
  formato: string
  aviso_conta: string | null
  destino: 'conta' | 'cartao'
  total: number
  contagem: Record<Situacao, number>
  totais: { entradas: number; saidas: number }
  invalidas: { linha: number; motivo: string }[]
  linhas: LinhaPrevia[]
}

type Resumo = {
  importadas: number
  conciliadas: number
  ja_existiam: number
  aguardando_conciliacao: number
  tratadas_depois?: number
  aguardando_pagamento?: number
  sem_categoria: number
}

type Cartao = { id: number; name: string }

// Destino escolhido: o valor do Select carrega o tipo junto do id ("c:3" conta, "k:2" cartão).
type Destino = { tipo: 'conta' | 'cartao'; id: number }

const LIMITE_LINHAS = 200
const NOVA_CONTA = '__nova__'
const chave = (d: Destino) => `${d.tipo === 'conta' ? 'c' : 'k'}:${d.id}`

const SITUACAO: Record<Situacao, { texto: string; ponto: string; linha?: string }> = {
  nova: { texto: 'Nova', ponto: 'bg-foreground' },
  ja_importada: { texto: 'Já importada', ponto: 'bg-muted-foreground/40', linha: 'text-muted-foreground' },
  suspeita: { texto: 'Possível duplicata', ponto: 'bg-destructive' },
  tratada_depois: { texto: 'Tratada depois', ponto: 'bg-muted-foreground/40', linha: 'text-muted-foreground' },
  pagamento_fatura: { texto: 'Possível pagamento de fatura', ponto: 'bg-destructive' },
}

const DECISOES: { value: Decisao; label: string }[] = [
  { value: 'merge', label: 'Fundir com o existente' },
  { value: 'not_duplicate', label: 'É nova' },
  { value: 'queue', label: 'Deixar na fila' },
]

/**
 * Importação de extrato em passos: Origem → Revisar → Confirmar.
 *
 * Não há passo de mapeamento: o sistema tem um layout padrão (modelo para
 * download) e o OFX já vem estruturado. A prévia não grava nada; o commit
 * reenvia o arquivo e as decisões, e o backend recalcula tudo a partir dele.
 */
export default function ImportarPage() {
  const [passo, setPasso] = useState(0)
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [destino, setDestino] = useState<Destino | null>(null)
  const [novaConta, setNovaConta] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({})
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarContas = useCallback(async () => {
    try {
      const [cs, ks] = await Promise.all([
        api<Conta[]>(`/api/accounts/user/${CURRENT_USER_ID}`),
        api<Cartao[]>(`/api/cards/user/${CURRENT_USER_ID}`),
      ])
      setContas(cs)
      setCartoes(ks)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as contas.')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados: o setState vem depois do await (o lint não enxerga dentro do useCallback async)
    carregarContas()
  }, [carregarContas])

  const conta = destino?.tipo === 'conta' ? (contas.find((c) => c.id === destino.id) ?? null) : null
  const cartao = destino?.tipo === 'cartao' ? (cartoes.find((c) => c.id === destino.id) ?? null) : null
  const nomeDestino = conta?.name ?? cartao?.name

  async function enviar<T>(rota: 'preview' | 'commit') {
    if (!arquivo || destino === null) return null
    const form = new FormData()
    form.append('file', arquivo)
    form.append('user_id', String(CURRENT_USER_ID))
    form.append(destino.tipo === 'conta' ? 'account_id' : 'card_id', String(destino.id))
    if (rota === 'commit') form.append('decisoes', JSON.stringify(decisoes))
    // Sem Content-Type manual: o navegador precisa definir o boundary do
    // multipart. `api()` respeita isso — passar FormData é a única forma de ele
    // não declarar o header.
    return api<T>(`/api/import/${rota}`, { method: 'POST', body: form })
  }

  async function analisar() {
    setCarregando(true)
    setErro(null)
    try {
      const p = await enviar<Previa>('preview')
      if (!p) return
      setPrevia(p)
      // Padrão conservador: suspeita vai para a fila até o usuário decidir.
      setDecisoes(
        Object.fromEntries(
          p.linhas.filter((l) => l.situacao === 'suspeita').map((l) => [l.import_hash, 'queue' as Decisao]),
        ),
      )
      setPasso(1)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.')
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    setCarregando(true)
    setErro(null)
    try {
      const gravado = await enviar<Resumo>('commit')
      if (!gravado) return
      setResumo(gravado)
      setPasso(2)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar.')
    } finally {
      setCarregando(false)
    }
  }

  function recomecar() {
    setPasso(0)
    setArquivo(null)
    setPrevia(null)
    setResumo(null)
    setDecisoes({})
    setErro(null)
  }

  const aGravar = previa ? previa.contagem.nova + previa.contagem.suspeita + previa.contagem.pagamento_fatura : 0
  const destinoItens = [
    ...contas.map((c) => ({ value: chave({ tipo: 'conta', id: c.id }), label: c.name })),
    ...cartoes.map((c) => ({ value: chave({ tipo: 'cartao', id: c.id }), label: `${c.name} (cartão)` })),
    { value: NOVA_CONTA, label: '+ Nova conta' },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/finance/transactions"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Transações
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Importar extrato</h1>
        <Steps steps={PASSOS} current={passo} />
      </div>

      {passo === 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground" htmlFor="destino-importacao">
              Conta ou cartão de destino
            </label>
            <Select
              items={destinoItens}
              value={destino === null ? null : chave(destino)}
              onValueChange={(v) => {
                if (v === NOVA_CONTA) setNovaConta(true)
                else if (v === null) setDestino(null)
                else setDestino({ tipo: v.startsWith('k:') ? 'cartao' : 'conta', id: Number(v.slice(2)) })
              }}
            >
              <SelectTrigger id="destino-importacao" className="w-full sm:w-80">
                <SelectValue placeholder="Escolha a conta ou cartão" />
              </SelectTrigger>
              <SelectContent>
                {destinoItens.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.value === NOVA_CONTA ? (
                      <span className="flex items-center gap-1.5">
                        <Plus className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                        Nova conta
                      </span>
                    ) : (
                      i.label
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {conta && (
              <p className="text-xs text-muted-foreground">{TIPOS_CONTA.find((t) => t.value === conta.kind)?.label}</p>
            )}
            {cartao && (
              <p className="text-xs text-muted-foreground">
                Fatura de cartão: valor negativo é compra; linhas positivas ficam para depois.
              </p>
            )}
          </div>

          <FileDropzone
            file={arquivo}
            onFile={(f) => {
              setArquivo(f)
              setErro(null)
            }}
          />

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              Aceita <strong className="font-medium text-foreground">OFX</strong> exportado pelo banco ou uma planilha no
              modelo do sistema, com as colunas <code className="rounded bg-muted px-1 py-0.5 text-xs">data</code>,{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">descricao</code> e{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">valor</code> (negativo é saída).
            </p>
            <div className="flex flex-wrap gap-2">
              {(['csv', 'xlsx'] as const).map((f) => (
                <Button
                  key={f}
                  variant="outline"
                  size="sm"
                  render={<a href={apiUrl(`/api/import/template/${f}`)} download />}
                  nativeButton={false}
                >
                  <Download className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Baixar modelo {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {passo === 1 && previa && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <strong className="font-semibold">{previa.contagem.nova}</strong> novas
            </span>
            <span className="text-muted-foreground">
              <strong className="font-semibold text-foreground">{previa.contagem.ja_importada}</strong> já importadas
            </span>
            <span className={previa.contagem.suspeita ? 'text-foreground' : 'text-muted-foreground'}>
              <strong className="font-semibold">{previa.contagem.suspeita}</strong> possíveis duplicatas
            </span>
            {previa.contagem.pagamento_fatura > 0 && (
              <span>
                <strong className="font-semibold">{previa.contagem.pagamento_fatura}</strong> possíveis pagamentos de fatura
              </span>
            )}
            {previa.contagem.tratada_depois > 0 && (
              <span className="text-muted-foreground">
                <strong className="font-semibold text-foreground">{previa.contagem.tratada_depois}</strong> tratadas depois
              </span>
            )}
            {previa.invalidas.length > 0 && (
              <span className="text-destructive">
                <strong className="font-semibold">{previa.invalidas.length}</strong> com problema
              </span>
            )}
          </div>

          {/* Entradas e saídas do arquivo: extrato com o sinal invertido salta aos olhos aqui. */}
          <p className="text-sm text-muted-foreground">
            {previa.destino === 'cartao' ? 'Cartão' : 'Conta'}{' '}
            <strong className="font-medium text-foreground">{nomeDestino}</strong> ·{' '}
            {previa.destino === 'cartao' ? 'positivas (tratadas depois)' : 'entradas'}{' '}
            <MoneyValue value={previa.totais.entradas} /> · {previa.destino === 'cartao' ? 'compras' : 'saídas'}{' '}
            <MoneyValue value={previa.totais.saidas} />
          </p>

          {previa.aviso_conta && (
            <p
              role="alert"
              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {previa.aviso_conta}
            </p>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previa.linhas.slice(0, LIMITE_LINHAS).map((l) => (
                  <TableRow key={l.linha} className={SITUACAO[l.situacao].linha}>
                    <TableCell className="tabular-nums">{formatDateBR(l.data)}</TableCell>
                    <TableCell className="max-w-[20rem]">
                      <span className="block truncate">{l.descricao}</span>
                      {l.candidato && (
                        <span className="block truncate text-xs text-muted-foreground">
                          Parece com: {l.candidato.descricao ?? 'lançamento'} · {formatDateBR(l.candidato.data)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.valor > 0 ? '+' : '−'}
                      <MoneyValue value={Math.abs(l.valor)} />
                    </TableCell>
                    <TableCell>
                      {l.situacao === 'suspeita' ? (
                        <Select
                          items={DECISOES}
                          value={decisoes[l.import_hash] ?? 'queue'}
                          onValueChange={(v) => v && setDecisoes((d) => ({ ...d, [l.import_hash]: v as Decisao }))}
                        >
                          <SelectTrigger size="sm" className="w-48" aria-label={`Decisão para ${l.descricao}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DECISOES.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="flex items-center gap-2 text-xs">
                          <span
                            className={cn('size-1.5 shrink-0 rounded-full', SITUACAO[l.situacao].ponto)}
                            aria-hidden="true"
                          />
                          {SITUACAO[l.situacao].texto}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {previa.linhas.length > LIMITE_LINHAS && (
            <p className="text-xs text-muted-foreground">
              Mostrando as primeiras {LIMITE_LINHAS} de {previa.linhas.length} linhas — todas serão importadas.
            </p>
          )}

          {previa.invalidas.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-destructive">
                <CircleAlert className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                Estas linhas não serão importadas
              </p>
              <ul className="flex flex-col gap-0.5 text-muted-foreground">
                {previa.invalidas.slice(0, 8).map((i) => (
                  <li key={i.linha}>
                    Linha {i.linha}: {i.motivo}
                  </li>
                ))}
                {previa.invalidas.length > 8 && <li>… e mais {previa.invalidas.length - 8}.</li>}
              </ul>
            </div>
          )}
        </section>
      )}

      {passo === 2 && resumo && (
        <section className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { rotulo: 'Importadas', valor: resumo.importadas },
              { rotulo: 'Fundidas', valor: resumo.conciliadas },
              { rotulo: 'Já existiam', valor: resumo.ja_existiam },
              { rotulo: 'Na fila', valor: resumo.aguardando_conciliacao },
              { rotulo: 'Sem categoria', valor: resumo.sem_categoria },
            ].map((c) => (
              <div key={c.rotulo} className="rounded-xl border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{c.rotulo}</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">{c.valor}</dd>
              </div>
            ))}
          </dl>
          {resumo.sem_categoria > 0 && (
            <p className="text-sm text-muted-foreground">
              As importadas entram como <strong className="font-medium text-foreground">Sem categoria</strong>. Use a
              seleção em lote em Transações para categorizar várias de uma vez.
            </p>
          )}
          {!!resumo.tratadas_depois && (
            <p className="text-sm text-muted-foreground">
              {resumo.tratadas_depois} {resumo.tratadas_depois === 1 ? 'linha positiva não foi importada' : 'linhas positivas não foram importadas'}:
              estorno e pagamento da fatura são tratados depois.
            </p>
          )}
          {!!resumo.aguardando_pagamento && (
            <p className="text-sm text-muted-foreground">
              {resumo.aguardando_pagamento} {resumo.aguardando_pagamento === 1 ? 'saída parece' : 'saídas parecem'} pagamento de fatura e
              espera em{' '}
              <Link href="/finance/revisar?secao=pagamentos" className="underline underline-offset-2">
                A revisar
              </Link>
              , fora do saldo e dos relatórios até você decidir.
            </p>
          )}
          {resumo.aguardando_conciliacao > 0 && (
            <p className="text-sm text-muted-foreground">
              {resumo.aguardando_conciliacao} possíveis duplicatas ficaram aguardando conciliação e ainda não aparecem
              nas telas.
            </p>
          )}
        </section>
      )}

      {erro && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {erro}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {passo === 1 ? (
          <Button variant="ghost" onClick={() => setPasso(0)} disabled={carregando}>
            Voltar
          </Button>
        ) : passo === 2 ? (
          <Button variant="ghost" onClick={recomecar}>
            Importar outro arquivo
          </Button>
        ) : (
          <span />
        )}

        {passo === 0 && (
          <Button onClick={analisar} disabled={!arquivo || destino === null || carregando}>
            {carregando ? 'Lendo...' : 'Revisar'}
          </Button>
        )}
        {passo === 1 && (
          <Button onClick={confirmar} pending={carregando} disabled={aGravar === 0}>
            {carregando
              ? 'Importando...'
              : aGravar === 0
                ? 'Nada novo para importar'
                : `Importar ${aGravar} ${aGravar === 1 ? 'linha' : 'linhas'}`}
          </Button>
        )}
        {passo === 2 && (
          <Button render={<Link href="/finance/transactions" />} nativeButton={false}>
            Ver transações
          </Button>
        )}
      </div>

      <NovaContaDialog
        open={novaConta}
        onOpenChange={setNovaConta}
        userId={CURRENT_USER_ID}
        onCreated={(c) => {
          setContas((cs) => [...cs, c])
          setDestino({ tipo: 'conta', id: c.id })
        }}
      />
    </div>
  )
}
