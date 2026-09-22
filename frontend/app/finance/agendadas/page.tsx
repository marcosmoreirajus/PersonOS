'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MonthStrip } from '@/components/ui/month-strip'
import { MonthCalendar } from './_components/MonthCalendar'
import { MonthForecast } from './_components/MonthForecast'
import { EMPTY_FILTERS, ScheduledFilters, type ScheduledFiltersValue } from './_components/ScheduledFilters'
import { PendingAlert } from './_components/PendingAlert'
import { UpcomingList } from './_components/UpcomingList'
import {
  buildCategoryMeta,
  isInMonth,
  monthForecast,
  pendingSummary,
  toScheduledItems,
  type Category,
  type ScheduledItem,
} from './_components/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

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

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        // Fonte única: Agendadas é uma visão de transações + séries.
        // `/api/scheduled` não existe mais.
        const [transactionsRes, seriesRes, categoriesRes] = await Promise.all([
          fetch(`${API_URL}/api/transactions/user/${CURRENT_USER_ID}`),
          fetch(`${API_URL}/api/series/user/${CURRENT_USER_ID}`),
          fetch(`${API_URL}/api/categories`),
        ])
        const [transactionsJson, seriesJson, categoriesJson] = await Promise.all([
          transactionsRes.json(),
          seriesRes.json(),
          categoriesRes.json(),
        ])
        if (!cancelled) {
          setItems(toScheduledItems(transactionsJson.data || [], seriesJson.data || []))
          setCategories(categoriesJson.data || [])
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar as agendadas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const monthItems = useMemo(() => items.filter((item) => isInMonth(item, month)), [items, month])

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
