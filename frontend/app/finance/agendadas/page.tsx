'use client'

import { useEffect, useMemo, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MonthCalendar } from './_components/MonthCalendar'
import { ScheduledFilters, type ScheduledFiltersValue } from './_components/ScheduledFilters'
import { UpcomingList } from './_components/UpcomingList'
import type { ScheduledItem } from './_components/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function AgendadasPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [filters, setFilters] = useState<ScheduledFiltersValue>({
    type: 'all',
    period: 'month',
    customStart: '',
    customEnd: '',
  })

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/scheduled/user/${CURRENT_USER_ID}`)
        const json = await res.json()
        if (!cancelled) setItems(json.data || [])
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.type !== 'all' && item.type !== filters.type) return false

      const due = new Date(`${item.due_date}T00:00:00`)

      if (filters.period === 'month') {
        return due.getFullYear() === month.getFullYear() && due.getMonth() === month.getMonth()
      }
      if (filters.period === 'last30') {
        const today = new Date()
        const start = new Date(today)
        start.setDate(start.getDate() - 30)
        return due >= start && due <= today
      }
      // custom
      if (!filters.customStart || !filters.customEnd) return true
      const start = new Date(`${filters.customStart}T00:00:00`)
      const end = new Date(`${filters.customEnd}T23:59:59`)
      return due >= start && due <= end
    })
  }, [items, filters, month])

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Agendadas</h1>
        <ScheduledFilters value={filters} onChange={setFilters} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Calendário do mês</CardTitle>
            <CardDescription>Vencimentos e agendamentos por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthCalendar
              items={items.filter((i) => filters.type === 'all' || i.type === filters.type)}
              month={month}
              onMonthChange={setMonth}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimentos</CardTitle>
            <CardDescription>{filteredItems.length} itens no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <UpcomingList items={filteredItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
