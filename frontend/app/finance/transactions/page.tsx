'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { ActionsMenu } from '@/components/ui/actions-menu'
import { CategoryMultiPicker } from '../_components/CategoryPicker'
import { Table, type TableColumn } from '@/components/motion/table'
import { categoryIcon } from '@/lib/category-icons'
import { cn } from '@/lib/utils'
import TransactionDialog, { type Category, type DialogSeed } from './_components/TransactionDialog'
import DeleteDialog from './_components/DeleteDialog'
import OverdueAlert from './_components/OverdueAlert'
import BulkActionsBar from './_components/BulkActionsBar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type Transaction = {
  id: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  /** Vem da API em todo lançamento; nulo até existir o módulo de Contas. */
  account_id: number | null
  due_date: string
  settled_at: string | null
  is_internal_transfer: boolean
  series_id: number | null
  series_index: number | null
}

/** previsto / atrasado / realizado — leitura, nunca campo gravado. */
type Situacao = 'realizado' | 'atrasado' | 'previsto'

function situacao(t: Transaction, hoje: string): Situacao {
  if (t.settled_at) return 'realizado'
  return t.due_date < hoje ? 'atrasado' : 'previsto'
}

const SITUACAO_META: Record<Situacao, { label: string; className: string }> = {
  realizado: { label: 'Realizado', className: 'text-muted-foreground' },
  previsto: { label: 'A vencer', className: 'text-muted-foreground' },
  atrasado: { label: 'Em atraso', className: 'text-destructive' },
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

type TipoFiltro = 'all' | 'income' | 'expense'

const TIPOS: { value: TipoFiltro; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tipo, setTipo] = useState<TipoFiltro>('all')
  // Várias categorias ao mesmo tempo: lista vazia = todas.
  const [categorias, setCategorias] = useState<string[]>([])
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  // `seed` preenche o formulario: com id = edicao, sem id = duplicacao.
  const [seed, setSeed] = useState<DialogSeed | null>(null)
  const [excluindo, setExcluindo] = useState<Transaction | null>(null)

  function abrirNovo() {
    setSeed(null)
    setDialogOpen(true)
  }

  function abrirEdicao(t: Transaction) {
    setSeed({ id: t.id, type: t.type, amount: t.amount, description: t.description, category_id: t.category_id, due_date: t.settled_at ?? t.due_date })
    setDialogOpen(true)
  }

  function abrirDuplicacao(t: Transaction) {
    // Sem `id`: duplicar cria um lancamento novo a partir deste.
    setSeed({ type: t.type, amount: t.amount, description: t.description, category_id: t.category_id, due_date: t.settled_at ?? t.due_date })
    setDialogOpen(true)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions/user/${CURRENT_USER_ID}`),
        fetch(`${API_URL}/api/categories`),
      ])
      const txJson = await txRes.json()
      const catJson = await catRes.json()
      setTransactions(txJson.data || [])
      setCategories(catJson.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const categoriaPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      if (tipo !== 'all' && t.type !== tipo) return false
      if (categorias.length > 0 && !categorias.includes(String(t.category_id))) return false
      if (q && !(t.description ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [transactions, query, tipo, categorias])

  /** Totais do rodapé: só o que foi efetivado — previsto não soma em resultado. */
  const totais = useMemo(() => {
    let entradas = 0
    let saidas = 0
    for (const t of filtradas) {
      if (!t.settled_at || t.is_internal_transfer) continue
      if (t.type === 'income') entradas += t.amount
      else saidas += t.amount
    }
    return { entradas, saidas, resultado: entradas - saidas }
  }, [filtradas])

  const columns: TableColumn<Transaction>[] = useMemo(
    () => [
      {
        key: 'due_date',
        header: 'Data',
        sortable: true,
        width: '120px',
        sortValue: (t) => t.settled_at ?? t.due_date,
        cell: (t) => <span className="tabular-nums">{formatDate(t.settled_at ?? t.due_date)}</span>,
      },
      {
        key: 'description',
        header: 'Descrição',
        sortable: true,
        cell: (t) => (
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{t.description ?? 'Sem descrição'}</span>
            {t.is_internal_transfer && <Badge color="var(--muted-foreground)">Interna</Badge>}
            {t.series_index != null && (
              <span className="shrink-0 text-xs text-muted-foreground">parcela {t.series_index}</span>
            )}
          </span>
        ),
      },
      {
        key: 'category_id',
        header: 'Categoria',
        sortable: true,
        width: '190px',
        sortValue: (t) => categoriaPorId.get(t.category_id ?? -1)?.name ?? 'zzz',
        cell: (t) => {
          const cat = categoriaPorId.get(t.category_id ?? -1)
          const Icon = categoryIcon(cat?.icon)
          return (
            <span className={cn('flex items-center gap-2', !cat && 'text-muted-foreground')}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              </span>
              {/* Ausência de categoria é mostrada, não escondida: é fila de revisão. */}
              {cat?.name ?? 'Sem categoria'}
            </span>
          )
        },
      },
      {
        key: 'settled_at',
        header: 'Situação',
        sortable: true,
        width: '130px',
        sortValue: (t) => situacao(t, hoje),
        cell: (t) => {
          const s = situacao(t, hoje)
          return <span className={cn('text-xs', SITUACAO_META[s].className)}>{SITUACAO_META[s].label}</span>
        },
      },
      {
        key: 'account_id',
        header: 'Conta',
        width: '140px',
        // O nome amigável da conta chega com o módulo de Contas (futuro);
        // enquanto isso a coluna existe mas o lançamento ainda não tem conta.
        cell: () => <span className="text-xs text-muted-foreground">—</span>,
      },
      {
        key: 'amount',
        header: 'Valor',
        sortable: true,
        align: 'right',
        width: '150px',
        cell: (t) => (
          <span
            className={cn(
              'font-medium tabular-nums',
              t.is_internal_transfer ? 'text-muted-foreground' : t.type === 'income' ? 'text-positive' : 'text-foreground'
            )}
          >
            {t.type === 'income' ? '+' : '−'}
            <MoneyValue value={t.amount} />
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        width: '64px',
        cell: (t) => (
          <span className="flex justify-end">
            {/* As ações variam por item: um lançamento de série oferece as três
                opções de escopo (decisão da sabatina); um avulso, não. Editar e
                excluir de verdade chegam na Fatia 2, junto do `scope` na API. */}
            <ActionsMenu
              label={`Ações de ${t.description ?? 'transação'}`}
              actions={[
                { key: 'edit', label: 'Editar', icon: Pencil, onSelect: () => abrirEdicao(t) },
                { key: 'duplicate', label: 'Duplicar', icon: Copy, onSelect: () => abrirDuplicacao(t) },
                {
                  key: 'delete',
                  label: t.series_id ? 'Excluir...' : 'Excluir',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setExcluindo(t),
                },
              ]}
            />
          </span>
        ),
      },
    ],
    [categoriaPorId, hoje]
  )

  // A tabela acompanha o volume: com 3 linhas não sobra faixa vazia, e a
  // partir de ~10 ela para de crescer e passa a rolar (a virtualização
  // aguenta o resto).
  const alturaTabela = useMemo(() => {
    const CABECALHO = 44
    const LINHA = 52
    const linhas = Math.max(filtradas.length, 1)
    return Math.min(CABECALHO + linhas * LINHA, 560)
  }, [filtradas.length])

  // Tipos presentes na seleção: o lote só pode oferecer categorias que valham
  // para todos os lançamentos marcados.
  const tiposSelecionados = useMemo(() => {
    const ids = new Set(selecionadas)
    return transactions.filter((t) => ids.has(String(t.id))).map((t) => t.type)
  }, [selecionadas, transactions])

  const chips = [
    tipo !== 'all' && {
      label: `Tipo: ${tipo === 'income' ? 'Entradas' : 'Saídas'}`,
      clear: () => setTipo('all'),
    },
    ...categorias.map((id) => ({
      label: `Categoria: ${categoriaPorId.get(Number(id))?.name ?? ''}`,
      clear: () => setCategorias((atual) => atual.filter((c) => c !== id)),
    })),
    query.trim() && { label: `Busca: "${query.trim()}"`, clear: () => setQuery('') },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  return (
    <div className="flex flex-col gap-4">
      <OverdueAlert transactions={transactions} categories={categories} onChanged={fetchData} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Transações</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/finance/importar" />} nativeButton={false}>
            <FileUp className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Importar extrato
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Lançamento manual
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        {/* Campo de filtro persistente, não paleta de comando: o
            `MorphingSearch` limpa a própria query toda vez que abre ou
            fecha (`useOnOpen(open, () => setQuery(''))`), porque foi feito
            pra sessões de busca efêmeras. Como filtro de tabela ele apagava
            o termo assim que perdia o foco. */}
        <div className="relative w-full shrink-0 sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descrição..."
            aria-label="Buscar por descrição"
            className="pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Tipo de lançamento"
          className="flex shrink-0 rounded-xl bg-muted p-1"
        >
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                tipo === t.value
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <CategoryMultiPicker
          categories={categories}
          value={categorias}
          onChange={setCategorias}
          className="shrink-0"
        />

        <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground sm:ml-auto">
          {filtradas.length} {filtradas.length === 1 ? 'transação' : 'transações'}
          {selecionadas.length > 0 && ` · ${selecionadas.length} selecionada(s)`}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent"
            >
              {c.label}
              <X className="size-3" strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
          <button
            onClick={() => {
              setTipo('all')
              setCategorias([])
              setQuery('')
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      <Table
        data={filtradas}
        columns={columns}
        getRowId={(t) => String(t.id)}
        selectable
        selectedRowIds={selecionadas}
        onSelectionChange={setSelecionadas}
        resizable
        defaultSort={{ key: 'due_date', direction: 'desc' }}
        rowHeight={52}
        height={alturaTabela}
        loading={loading}
        emptyState={<p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>}
      />

      <div className="flex flex-wrap items-center justify-end gap-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Entradas <MoneyValue value={totais.entradas} className="font-medium text-positive" />
        </span>
        <span className="text-muted-foreground">
          Saídas <MoneyValue value={totais.saidas} className="font-medium text-foreground" />
        </span>
        <span className="font-medium text-foreground">
          Resultado <MoneyValue value={totais.resultado} />
        </span>
      </div>

      <BulkActionsBar
        ids={selecionadas}
        tipos={tiposSelecionados}
        categories={categories}
        onClear={() => setSelecionadas([])}
        onDone={fetchData}
      />

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        userId={CURRENT_USER_ID}
        onSaved={fetchData}
        seed={seed}
      />


      <DeleteDialog
        transaction={excluindo}
        onOpenChange={(open) => !open && setExcluindo(null)}
        onDeleted={fetchData}
      />
    </div>
  )
}
