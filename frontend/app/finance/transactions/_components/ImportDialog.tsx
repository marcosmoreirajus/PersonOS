'use client'

import { useState } from 'react'
import { CircleAlert, FileUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyValue } from '@/components/ui/money-value'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Situacao = 'nova' | 'ja_importada' | 'suspeita'

type LinhaPrevia = {
  linha: number
  data: string
  descricao: string
  valor: number
  situacao: Situacao
  candidato?: { id: number; descricao: string | null; data: string }
}

type Previa = {
  formato: string
  total: number
  contagem: Record<Situacao, number>
  invalidas: { linha: number; motivo: string }[]
  linhas: LinhaPrevia[]
}

type Resumo = {
  importadas: number
  ja_existiam: number
  aguardando_conciliacao: number
  sem_categoria: number
  invalidas: { linha: number; motivo: string }[]
}

type Passo = 'escolher' | 'previa' | 'resumo'

/** Linhas mostradas na prévia: mais que isso vira rolagem sem informação útil. */
const LIMITE_LINHAS = 200

const SITUACAO: Record<Situacao, { texto: string; ponto: string; linha?: string }> = {
  nova: { texto: 'Nova', ponto: 'bg-foreground' },
  ja_importada: { texto: 'Já importada', ponto: 'bg-muted-foreground/40', linha: 'text-muted-foreground' },
  suspeita: { texto: 'Possível duplicata', ponto: 'bg-destructive' },
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/**
 * Importação de extrato: escolher → prévia → resumo.
 *
 * A prévia NÃO grava nada. O commit reenvia o arquivo em vez de mandar as
 * linhas de volta: o backend recalcula tudo a partir dele, então o que entra na
 * base não depende de um payload que o cliente possa ter alterado.
 *
 * A situação de cada linha é status, então usa texto + ponto — o `Badge` é
 * para categoria/tipo, e a própria documentação dele proíbe usá-lo para status.
 */
export function ImportDialog({
  open,
  onOpenChange,
  userId,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  onImported: () => void
}) {
  const [passo, setPasso] = useState<Passo>('escolher')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar(aberto: boolean) {
    onOpenChange(aberto)
    if (!aberto) {
      // Volta ao início ao fechar: reabrir mostrando o resumo de uma
      // importação antiga confundiria com a próxima.
      setPasso('escolher')
      setArquivo(null)
      setPrevia(null)
      setResumo(null)
      setErro(null)
    }
  }

  async function enviar(rota: 'preview' | 'commit') {
    if (!arquivo) return null
    const form = new FormData()
    form.append('file', arquivo)
    form.append('user_id', String(userId))
    // Sem Content-Type manual: o navegador precisa definir o boundary do multipart.
    const res = await fetch(`${API_URL}/api/import/${rota}`, { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : 'Não foi possível ler o arquivo.')
    return json.data
  }

  async function analisar() {
    setCarregando(true)
    setErro(null)
    try {
      setPrevia(await enviar('preview'))
      setPasso('previa')
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
      setResumo(await enviar('commit'))
      setPasso('resumo')
      onImported()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar.')
    } finally {
      setCarregando(false)
    }
  }

  const aGravar = previa ? previa.contagem.nova + previa.contagem.suspeita : 0

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar extrato</DialogTitle>
        </DialogHeader>

        {passo === 'escolher' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Aceita <strong className="font-medium text-foreground">OFX</strong> exportado pelo banco, ou uma planilha{' '}
              <strong className="font-medium text-foreground">CSV / XLSX</strong> com as colunas{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">data</code>,{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">descricao</code> e{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">valor</code>.
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              <li>Valor com sinal: negativo é saída, positivo é entrada.</li>
              <li>Data em DD/MM/AAAA ou AAAA-MM-DD.</li>
              <li>Nada é gravado antes de você conferir a prévia.</li>
            </ul>
            <Input
              type="file"
              accept=".ofx,.qfx,.csv,.txt,.xlsx"
              aria-label="Arquivo do extrato"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null)
                setErro(null)
              }}
            />
          </div>
        )}

        {passo === 'previa' && previa && (
          <div className="flex flex-col gap-3">
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
              {previa.invalidas.length > 0 && (
                <span className="text-destructive">
                  <strong className="font-semibold">{previa.invalidas.length}</strong> com problema
                </span>
              )}
            </div>

            {previa.contagem.suspeita > 0 && (
              <p className="text-xs text-muted-foreground">
                Possíveis duplicatas <strong className="font-medium text-foreground">não entram</strong> nas telas até
                você decidir: ficam aguardando conciliação. As novas entram na hora.
              </p>
            )}

            <div className="max-h-72 overflow-auto rounded-xl border border-border">
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
                      <TableCell className="tabular-nums">{formatDate(l.data)}</TableCell>
                      <TableCell className="max-w-[18rem]">
                        <span className="block truncate">{l.descricao}</span>
                        {l.candidato && (
                          <span className="block truncate text-xs text-muted-foreground">
                            Parece com: {l.candidato.descricao ?? 'lançamento'} · {formatDate(l.candidato.data)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.valor > 0 ? '+' : '−'}
                        <MoneyValue value={Math.abs(l.valor)} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 text-xs">
                          <span className={cn('size-1.5 shrink-0 rounded-full', SITUACAO[l.situacao].ponto)} aria-hidden="true" />
                          {SITUACAO[l.situacao].texto}
                        </span>
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
          </div>
        )}

        {passo === 'resumo' && resumo && (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { rotulo: 'Importadas', valor: resumo.importadas },
                { rotulo: 'Já existiam', valor: resumo.ja_existiam },
                { rotulo: 'Aguardando conciliação', valor: resumo.aguardando_conciliacao },
                { rotulo: 'Sem categoria', valor: resumo.sem_categoria },
              ].map((c) => (
                <div key={c.rotulo} className="rounded-xl border border-border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{c.rotulo}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{c.valor}</dd>
                </div>
              ))}
            </dl>
            {resumo.sem_categoria > 0 && (
              <p className="text-xs text-muted-foreground">
                As importadas entram como <strong className="font-medium text-foreground">Sem categoria</strong>. Use a
                seleção em lote na lista para categorizar várias de uma vez.
              </p>
            )}
            {resumo.aguardando_conciliacao > 0 && (
              <p className="text-xs text-muted-foreground">
                As {resumo.aguardando_conciliacao} possíveis duplicatas ainda não aparecem nas telas. A tela para
                resolvê-las (fundir com o lançamento existente ou confirmar como nova) é a próxima etapa.
              </p>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {erro}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {passo === 'previa' ? (
            <Button variant="ghost" onClick={() => setPasso('escolher')} disabled={carregando}>
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => fechar(false)} disabled={carregando}>
              {passo === 'resumo' ? 'Fechar' : 'Cancelar'}
            </Button>
          )}

          {passo === 'escolher' && (
            <Button onClick={analisar} disabled={!arquivo || carregando}>
              <FileUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {carregando ? 'Lendo...' : 'Ver prévia'}
            </Button>
          )}
          {passo === 'previa' && (
            <Button onClick={confirmar} disabled={carregando || aGravar === 0}>
              {carregando
                ? 'Importando...'
                : aGravar === 0
                  ? 'Nada novo para importar'
                  : `Importar ${aGravar} ${aGravar === 1 ? 'linha' : 'linhas'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImportDialog
