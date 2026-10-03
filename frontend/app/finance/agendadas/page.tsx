'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MonthStrip } from '@/components/ui/month-strip'
import { MonthCalendar } from './_components/MonthCalendar'
import { MonthForecast } from './_components/MonthForecast'
import { EMPTY_FILTERS, ScheduledFilters, type ScheduledFiltersValue } from './_components/ScheduledFilters'
import { PendingAlert } from './_components/PendingAlert'
import { UpcomingList } from './_components/UpcomingList'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { isoLocal } from '@/lib/dates'
import {
  buildCategoryMeta,
  isInMonth,
  monthForecast,
  pendingSummary,
  projectedToScheduledItems,
  toScheduledItems,
  type Category,
  type ProjectedOccurrence,
  type ScheduledItem,
  type Series,
  type Transaction,
} from './_components/types'

// Referência estável: `projetados` entra em dependência de `useMemo`.
const NENHUM_ITEM: ScheduledItem[] = []

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function AgendadasPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [filters, setFilters] = useState<ScheduledFiltersValue>(EMPTY_FILTERS)
  const [series, setSeries] = useState<Series[]>([])
  // A projeção guarda de qual mês veio: trocar de mês não mostra a do mês
  // anterior enquanto a nova não chega.
  const [projecao, setProjecao] = useState<{ mes: string; itens: ScheduledItem[] }>({ mes: '', itens: [] })

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        // Fonte única: Agendadas é uma visão de transações + séries.
        // `/api/scheduled` não existe mais.
        const [transactions, listaSeries, listaCategorias] = await Promise.all([
          api<Transaction[]>(`/api/transactions/user/${CURRENT_USER_ID}`),
          api<Series[]>(`/api/series/user/${CURRENT_USER_ID}`),
          api<Category[]>('/api/categories'),
        ])
        if (!cancelled) {
          setItems(toScheduledItems(transactions, listaSeries))
          setSeries(listaSeries)
          setCategories(listaCategorias)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar as agendadas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const materializadosDoMes = useMemo(() => items.filter((item) => isInMonth(item, month)), [items, month])

  // Projeção só entra quando o mês não tem nada materializado — ou seja, além
  // do horizonte de geração. Dentro dele, o que vale é o registro de verdade;
  // somar os dois mostraria a mesma obrigação duas vezes.
  const precisaProjecao = materializadosDoMes.length === 0 && series.length > 0
  const mesAtual = isoLocal(month)
  const projetados = precisaProjecao && projecao.mes === mesAtual ? projecao.itens : NENHUM_ITEM

  useEffect(() => {
    if (!precisaProjecao) return
    let cancelado = false
    const mes = isoLocal(month)
    const de = isoLocal(new Date(month.getFullYear(), month.getMonth(), 1))
    const ate = isoLocal(new Date(month.getFullYear(), month.getMonth() + 1, 0))

    api<ProjectedOccurrence[]>(`/api/series/projection/${CURRENT_USER_ID}`, { query: { de, ate } })
      .then((itens) => {
        if (!cancelado) setProjecao({ mes, itens: projectedToScheduledItems(itens, series) })
      })
      .catch((e: unknown) => {
        // Antes a falha virava "este mês não tem nada" — o mês vazio é uma
        // informação real, e esconder a falha atrás dele mentia sobre ela.
        if (!cancelado) setError(e instanceof Error ? e.message : 'Não foi possível projetar o mês.')
      })
    return () => {
      cancelado = true
    }
  }, [month, precisaProjecao, series])

  const monthItems = useMemo(
    () => (materializadosDoMes.length > 0 ? materializadosDoMes : projetados),
    [materializadosDoMes, projetados]
  )

  const mostrandoProjecao = materializadosDoMes.length === 0 && projetados.length > 0

  const categoryMeta = useMemo(() => buildCategoryMeta(monthItems, categories), [monthItems, categories])
  const forecast = useMemo(() => monthForecast(monthItems), [monthItems])
  // Pendências do mês inteiro, ignorando os filtros — o alerta é sobre o mês, não sobre a seleção.
  const getMonthAlert = useCallback(
    (m: Date) => {
      const summary = pendingSummary(
        items.filter((item) => isInMonth(item, m)),
        new Date()
      )
      if (summary.toPay.count === 0 && summary.toReceive.count === 0) return null
      return <PendingAlert summary={summary} month={m} />
    },
    [items]
  )

  const filteredItems = useMemo(
    () =>
      monthItems.filter(
        (item) =>
          (filters.categoryId === 'all' || item.category_id === filters.categoryId) &&
          (filters.nature === 'all' || item.nature === filters.nature)
      ),
    [monthItems, filters]
  )

  if (loading) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Agendadas</h1>
          <ScheduledFilters value={filters} onChange={setFilters} categoryMeta={categoryMeta} />
        </div>
        <MonthStrip
          value={month}
          onChange={(next) => {
            setMonth(next)
            // A lista de categorias do filtro é a do mês — a escolhida pode não existir no novo.
            setFilters((f) => ({ ...f, categoryId: 'all' }))
          }}
          getMonthAlert={getMonthAlert}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Calendário do mês</CardTitle>
            <CardDescription>O que entra e o que sai em cada dia</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <MonthForecast forecast={forecast} />
            <MonthCalendar items={filteredItems} month={month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimentos</CardTitle>
            <CardDescription>
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'} no mês
              {/* Além do horizonte de geração não existe registro — o que
                  aparece é calculado da regra da série. Dizer isso evita que
                  o usuário tente pagar algo que ainda não existe. */}
              {mostrandoProjecao && ' · previsão, ainda não lançada'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpcomingList items={filteredItems} categoryMeta={categoryMeta} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
