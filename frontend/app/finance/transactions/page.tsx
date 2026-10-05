'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { ActionsMenu } from '@/components/ui/actions-menu'
import { CategoryMultiPicker } from '../_components/CategoryPicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, type SortState, type TableColumn } from '@/components/motion/table'
import { categoryIcon } from '@/lib/category-icons'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { hojeLocal, formatDateBR } from '@/lib/dates'
import { categoriasConhecidas, dentroDoIntervalo, lerUrl, montarBusca, type TipoFiltro } from '@/lib/transacoes-url'
import TransactionDialog, { type Category, type DialogSeed } from './_components/TransactionDialog'
import DeleteDialog from './_components/DeleteDialog'
import OverdueAlert from './_components/OverdueAlert'
import BulkActionsBar from './_components/BulkActionsBar'

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

const TIPOS: { value: TipoFiltro; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
]

const TAMANHOS_PAGINA = [10, 50, 100, 200, 500]
const TAMANHO_ITENS = TAMANHOS_PAGINA.map((n) => ({ value: String(n), label: String(n) }))

/** O que o formulário recebe para editar este lançamento. */
function seedDeEdicao(t: Transaction): DialogSeed {
  return { id: t.id, type: t.type, amount: t.amount, description: t.description, category_id: t.category_id, due_date: t.settled_at ?? t.due_date }
}

function TransactionsContent() {
  // O que a tela mostra (filtros e lançamento em edição) nasce da URL e volta
  // para ela (issue #6): qualquer link do app leva a uma lista já filtrada ou a
  // um lançamento aberto. Só o estado inicial vem daqui; depois a tela manda.
  const queryString = useSearchParams().toString()
  const [inicial] = useState(() => lerUrl(queryString))
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  // Antes não havia: a falha de carga virava lista vazia, e uma lista vazia sem
  // aviso se confunde com "não tem lançamento nenhum".
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(inicial.q)
  const [tipo, setTipo] = useState<TipoFiltro>(inicial.tipo)
  // Várias categorias ao mesmo tempo: lista vazia = todas.
  const [categorias, setCategorias] = useState<string[]>(inicial.categorias)
  // Intervalo de datas (inclusivo) sobre a data que a tabela mostra.
  const [de, setDe] = useState<string | null>(inicial.de)
  const [ate, setAte] = useState<string | null>(inicial.ate)
  // Lançamento em edição: vai para a URL. O pedido que veio na URL só pode ser
  // atendido quando os lançamentos chegarem; até lá fica guardado aqui.
  const [editarId, setEditarId] = useState<number | null>(inicial.editar)
  const [editarPendente, setEditarPendente] = useState<number | null>(inicial.editar)
  const [avisoEdicao, setAvisoEdicao] = useState<string | null>(null)
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  // `seed` preenche o formulario: com id = edicao, sem id = duplicacao.
  const [seed, setSeed] = useState<DialogSeed | null>(null)
  const [excluindo, setExcluindo] = useState<Transaction | null>(null)
  // Ordenação controlada aqui (e não dentro da Table): com paginação, ordenar
  // só a página visível daria uma ordem errada entre páginas.
  const [ordem, setOrdem] = useState<SortState | null>({ key: 'due_date', direction: 'desc' })
  const [porPagina, setPorPagina] = useState(10)
  // Categorias da URL que não existem (apagadas, erradas) são ignoradas em
  // silêncio. Enquanto as categorias não chegaram, vale o que foi pedido.
  const categoriasAtivas = useMemo(
    () => (categories.length === 0 ? categorias : categoriasConhecidas(categorias, categories.map((c) => c.id))),
    [categories, categorias]
  )
  // A página fica guardada junto do filtro em que foi escolhida: mudou o
  // filtro, ela volta pra 1 sem precisar de efeito.
  const chaveFiltro = JSON.stringify([query, tipo, categoriasAtivas, de, ate])
  const [paginaEscolhida, setPaginaEscolhida] = useState({ chave: chaveFiltro, pagina: 1 })
  const pagina = paginaEscolhida.chave === chaveFiltro ? paginaEscolhida.pagina : 1
  const setPagina = (p: number) => setPaginaEscolhida({ chave: chaveFiltro, pagina: p })

  function abrirNovo() {
    setSeed(null)
    setEditarId(null)
    setDialogOpen(true)
  }

  function abrirEdicao(t: Transaction) {
    setAvisoEdicao(null)
    setSeed(seedDeEdicao(t))
    setEditarId(t.id)
    setDialogOpen(true)
  }

  function abrirDuplicacao(t: Transaction) {
    // Sem `id`: duplicar cria um lancamento novo a partir deste.
    setSeed({ ...seedDeEdicao(t), id: undefined })
    setEditarId(null)
    setDialogOpen(true)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tx, cats] = await Promise.all([
        api<Transaction[]>(`/api/transactions/user/${CURRENT_USER_ID}`),
        api<Category[]>('/api/categories'),
      ])
      setTransactions(tx)
      setCategories(cats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as transações.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados: o único setState síncrono é o `loading`; o resto vem depois do await
    fetchData()
  }, [fetchData])

  // Atende o `editar` pedido pela URL assim que os lançamentos chegam: abre a
  // edição, ou avisa que o lançamento não existe (apagado, de outro usuário).
  // Se a carga falhou, o aviso de erro já fala por si: não afirma "não existe".
  // Ajusta o estado durante a renderização (e não num efeito): o pedido some
  // na mesma passada, então não repete.
  if (editarPendente !== null && !loading) {
    setEditarPendente(null)
    const t = transactions.find((x) => x.id === editarPendente)
    if (t) {
      setAvisoEdicao(null)
      setSeed(seedDeEdicao(t))
      setDialogOpen(true)
    } else {
      setEditarId(null)
      if (!error) setAvisoEdicao(`Não encontramos o lançamento ${editarPendente}. Ele pode ter sido apagado.`)
    }
  }

  // Quando a URL muda por um link do app (e não porque a tela a escreveu), a
  // tela a segue: um link para `?editar=5` abre o lançamento mesmo com a página
  // já montada. Ajusta o estado durante a renderização, como o diálogo faz com
  // `hidratadoPara`. A URL que a própria tela escreveu coincide com o que ela
  // montaria do seu estado, então não conta como link.
  const [urlVista, setUrlVista] = useState(queryString)
  if (queryString !== urlVista) {
    setUrlVista(queryString)
    const pedido = lerUrl(queryString)
    const daTela = montarBusca({ editar: editarId, q: query, tipo, categorias: categoriasAtivas, de, ate })
    if (montarBusca(pedido) !== daTela) {
      setQuery(pedido.q)
      setTipo(pedido.tipo)
      setCategorias(pedido.categorias)
      setDe(pedido.de)
      setAte(pedido.ate)
      setEditarId(pedido.editar)
      setEditarPendente(pedido.editar)
      setAvisoEdicao(null)
      if (pedido.editar === null) setDialogOpen(false)
    }
  }

  // A URL acompanha a tela. `replaceState` (e não `push`) para digitar na
  // busca não criar uma entrada de histórico por tecla, e para o botão voltar
  // não reabrir um lançamento já fechado. O Next integra a chamada ao roteador.
  useEffect(() => {
    const novaBusca = montarBusca({ editar: editarId, q: query, tipo, categorias: categoriasAtivas, de, ate })
    if (novaBusca !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + novaBusca)
    }
  }, [editarId, query, tipo, categoriasAtivas, de, ate])

  const categoriaPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const hoje = useMemo(() => hojeLocal(), [])

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      if (tipo !== 'all' && t.type !== tipo) return false
      if (categoriasAtivas.length > 0 && !categoriasAtivas.includes(String(t.category_id))) return false
      if (q && !(t.description ?? '').toLowerCase().includes(q)) return false
      if (!dentroDoIntervalo(t.settled_at ?? t.due_date, de, ate)) return false
      return true
    })
  }, [transactions, query, tipo, categoriasAtivas, de, ate])

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
        cell: (t) => <span className="tabular-nums">{formatDateBR(t.settled_at ?? t.due_date)}</span>,
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

  const ordenadas = useMemo(() => {
    if (!ordem) return filtradas
    const coluna = columns.find((c) => c.key === ordem.key)
    if (!coluna) return filtradas
    const valor = (t: Transaction) =>
      coluna.sortValue ? coluna.sortValue(t) : (t as unknown as Record<string, string | number>)[coluna.key]
    return [...filtradas].sort((a, b) => {
      const av = valor(a)
      const bv = valor(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return ordem.direction === 'asc' ? cmp : -cmp
    })
  }, [filtradas, ordem, columns])

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina))
  // Filtro, exclusão ou troca do tamanho podem encolher a lista: nunca fica
  // parado numa página que deixou de existir.
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * porPagina
  const visiveis = useMemo(() => ordenadas.slice(inicio, inicio + porPagina), [ordenadas, inicio, porPagina])

  // A tabela acompanha o volume: com 3 linhas não sobra faixa vazia, e a
  // partir de ~10 ela para de crescer e passa a rolar (a virtualização
  // aguenta o resto).
  const alturaTabela = useMemo(() => {
    const CABECALHO = 44
    const LINHA = 52
    const linhas = Math.max(visiveis.length, 1)
    return Math.min(CABECALHO + linhas * LINHA, 560)
  }, [visiveis.length])

  // Tipos presentes na seleção: o lote só pode oferecer categorias que valham
  // para todos os lançamentos marcados.
  const tiposSelecionados = useMemo(() => {
    const ids = new Set(selecionadas)
    return transactions.filter((t) => ids.has(String(t.id))).map((t) => t.type)
  }, [selecionadas, transactions])

  // Chave própria por chip (não o texto): com categorias vindas da URL, antes de
  // elas carregarem dois chips teriam o mesmo texto, e o React deixaria um para trás.
  // Categoria sem nome ainda (carregando) não vira chip.
  const chips = [
    tipo !== 'all' && {
      key: 'tipo',
      label: `Tipo: ${tipo === 'income' ? 'Entradas' : 'Saídas'}`,
      clear: () => setTipo('all'),
    },
    ...categoriasAtivas.flatMap((id) => {
      const nome = categoriaPorId.get(Number(id))?.name
      return nome ? [{ key: `categoria-${id}`, label: `Categoria: ${nome}`, clear: () => setCategorias((atual) => atual.filter((c) => c !== id)) }] : []
    }),
    de && { key: 'de', label: `A partir de ${formatDateBR(de)}`, clear: () => setDe(null) },
    ate && { key: 'ate', label: `Até ${formatDateBR(ate)}`, clear: () => setAte(null) },
    query.trim() && { key: 'busca', label: `Busca: "${query.trim()}"`, clear: () => setQuery('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  return (
    <div className="flex flex-col gap-4">
      <OverdueAlert transactions={transactions} categories={categories} onChanged={fetchData} />

      {error && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {avisoEdicao && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
        >
          <span>{avisoEdicao}</span>
          <button
            type="button"
            onClick={() => setAvisoEdicao(null)}
            aria-label="Fechar aviso"
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

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
          value={categoriasAtivas}
          onChange={setCategorias}
          className="shrink-0"
        />

        {/* Ao sair do campo, se uma ponta passou da outra, a outra acompanha:
            um intervalo invertido não existe (a URL o ignoraria por inteiro).
            Corrigir a cada tecla apagaria a outra data enquanto o ano é digitado. */}
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          De
          <Input
            type="date"
            value={de ?? ''}
            onChange={(e) => setDe(e.target.value || null)}
            onBlur={() => {
              if (de && ate && de > ate) setAte(de)
            }}
            aria-label="Data inicial"
            className="w-40"
          />
        </label>
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          Até
          <Input
            type="date"
            value={ate ?? ''}
            onChange={(e) => setAte(e.target.value || null)}
            onBlur={() => {
              if (de && ate && ate < de) setDe(ate)
            }}
            aria-label="Data final"
            className="w-40"
          />
        </label>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
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
              setDe(null)
              setAte(null)
              setQuery('')
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Limpar tudo
          </button>
        </div>
      )}

      <Table
        data={visiveis}
        columns={columns}
        getRowId={(t) => String(t.id)}
        selectable
        selectedRowIds={selecionadas}
        onSelectionChange={setSelecionadas}
        resizable
        sort={ordem}
        onSortChange={(s) => {
          setOrdem(s)
          setPagina(1)
        }}
        rowHeight={52}
        height={alturaTabela}
        loading={loading}
        emptyState={<p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {ordenadas.length === 0
            ? 'Mostrando 0 de 0'
            : `Mostrando ${inicio + 1}-${inicio + visiveis.length} de ${ordenadas.length}`}
          {selecionadas.length > 0 && ` · ${selecionadas.length} selecionada(s)`}
        </span>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span id="por-pagina-label">Linhas por página</span>
            <Select
              items={TAMANHO_ITENS}
              value={String(porPagina)}
              onValueChange={(v) => {
                if (!v) return
                setPorPagina(Number(v))
                setPagina(1)
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-labelledby="por-pagina-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAMANHO_ITENS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav aria-label="Paginação" className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setPagina(1)} disabled={paginaAtual <= 1} aria-label="Primeira página">
              <ChevronsLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setPagina(paginaAtual - 1)} disabled={paginaAtual <= 1} aria-label="Página anterior">
              <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
            <span className="px-2 tabular-nums">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => setPagina(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas} aria-label="Próxima página">
              <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setPagina(totalPaginas)} disabled={paginaAtual >= totalPaginas} aria-label="Última página">
              <ChevronsRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </div>

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
        onOpenChange={(aberto) => {
          setDialogOpen(aberto)
          if (!aberto) setEditarId(null)
        }}
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

// `useSearchParams` precisa de um limite de Suspense para a página poder ser
// gerada estaticamente (o mesmo cuidado de "A revisar").
export default function TransactionsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando...</p>}>
      <TransactionsContent />
    </Suspense>
  )
}
