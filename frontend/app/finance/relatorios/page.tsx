'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleAlert } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CategoryBreakdown, rankWithUncategorized, REVISAR_SEM_CATEGORIA } from '../_components/CategoryBreakdown'
import { PeriodSelector } from './_components/PeriodSelector'
import { ResultCards, type ResumoPeriodo } from './_components/ResultCards'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { categoryColorByRank } from '@/lib/category-colors'
import { hojeLocal } from '@/lib/dates'
import { lerPeriodo, montarBuscaPeriodo, type PeriodoEscolhido } from '@/lib/relatorios-periodo'

type DashboardSummary = {
  balance: number
  income: number
  expense: number
  expenses_by_category: Record<string, number>
  /** Gasto efetivado com `category_id` nulo — o balde virtual do spec. */
  uncategorized_expense: number
}

/**
 * Despesas por categoria. Este bloco é do ticket #17 e AINDA NÃO segue o
 * período: lê o resumo que soma tudo o que está efetivado. Fica como estava.
 */
function DespesasPorCategoria() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const dash = await api<DashboardSummary>(`/api/dashboard/${CURRENT_USER_ID}`)
        if (!cancelled) {
          setSummary(dash)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar os relatórios.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (error || !summary) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error || 'Nenhum dado disponível.'}
      </div>
    )
  }

  const uncategorized = summary.uncategorized_expense ?? 0
  const categoryData = rankWithUncategorized(
    Object.entries(summary.expenses_by_category).map(([name, value]) => ({ name, value })),
    uncategorized,
    categoryColorByRank
  )
  // Sem transferência interna nas somas, categorias + balde = despesa do card.
  const pctSemCategoria = summary.expense > 0 ? (uncategorized / summary.expense) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por categoria</CardTitle>
        <CardDescription>Onde o dinheiro saiu, de tudo o que está registrado (ainda não segue o período)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {uncategorized > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground">
            <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {/* Arredonda para cima: 0,4% sem categoria não pode aparecer como 0%. */}
            <span>
              {Math.ceil(pctSemCategoria)}% das despesas (<MoneyValue value={uncategorized} />) estão sem categoria.
            </span>
            <Link href={REVISAR_SEM_CATEGORIA} className="font-medium underline underline-offset-4">
              Classificar agora
            </Link>
          </p>
        )}
        <CategoryBreakdown data={categoryData} />
      </CardContent>
    </Card>
  )
}

function RelatoriosContent() {
  const busca = useSearchParams()
  const [periodo, setPeriodo] = useState<PeriodoEscolhido>(() => lerPeriodo(busca))
  // Datas digitadas no personalizado, antes de as duas existirem.
  const [rascunho, setRascunho] = useState({ de: periodo.de ?? '', ate: periodo.ate ?? '' })
  // A resposta leva a chave do período que a pediu: se a chave atual é outra,
  // ainda está carregando (sem setState dentro do efeito).
  const [resposta, setResposta] = useState<{ chave: string; resumo: ResumoPeriodo | null; erro: string | null } | null>(null)
  const chave = `${periodo.atalho}|${periodo.de}|${periodo.ate}`
  const atual = resposta?.chave === chave ? resposta : null
  const loading = !atual
  const error = atual?.erro ?? null
  const resumo = atual?.resumo ?? null

  // "Hoje" é o do relógio local do cliente; a API só recebe a data.
  const hoje = useMemo(() => hojeLocal(), [])

  // Personalizado ainda sem as duas datas: a tela mostra os campos e espera.
  const incompleto = periodo.atalho === 'personalizado' && (!periodo.de || !periodo.ate)

  // A URL acompanha a tela (`replaceState`, sem entrada de histórico por data digitada).
  useEffect(() => {
    const novaBusca = montarBuscaPeriodo(periodo)
    if (novaBusca !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + novaBusca)
    }
  }, [periodo])

  useEffect(() => {
    if (incompleto) return
    let cancelled = false
    api<ResumoPeriodo>(`/api/reports/summary/${CURRENT_USER_ID}`, {
      query: { periodo: periodo.atalho, hoje, de: periodo.de, ate: periodo.ate },
    })
      .then((dados) => {
        if (!cancelled) setResposta({ chave, resumo: dados, erro: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResposta({ chave, resumo: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar o resumo do período.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [periodo, hoje, incompleto, chave])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>

      <PeriodSelector periodo={periodo} onChange={setPeriodo} rascunho={rascunho} onRascunho={setRascunho} />

      {incompleto ? (
        <p className="text-muted-foreground">Escolha a data inicial e a final.</p>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : loading || !resumo ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <ResultCards resumo={resumo} />
      )}

      <DespesasPorCategoria />
    </div>
  )
}

// `useSearchParams` precisa de um limite de Suspense para a página poder ser
// gerada estaticamente (o mesmo cuidado de "A revisar" e de Transações).
export default function RelatoriosPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando...</p>}>
      <RelatoriosContent />
    </Suspense>
  )
}
