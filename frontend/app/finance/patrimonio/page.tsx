'use client'

import { useEffect, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoneyValue } from '@/components/ui/money-value'
import { MonthPicker } from '@/components/ui/month-picker'
import { EvolutionChart, formatMonth, type EvolutionPoint } from './_components/EvolutionChart'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

// Patrimônio é P&B (peso por opacidade), nunca colorido — decisão de
// 2026-09-14: "Despesas = colorido (atenção) vs. Patrimônio = P&B (sóbrio)".
// Maior classe = opacidade cheia, decrescendo por tamanho.
const OPACITY_BY_RANK = [1, 0.6, 0.35, 0.18]

type Holding = {
  id: number
  class: string
  current_value: number
  target_allocation: number
}

type CoastFiConfig = {
  idade_atual: number
  idade_aposentadoria: number
  gasto_anual_desejado: number
  retorno_real_esperado: number
  taxa_retirada_segura: number
}

type Investments = {
  holdings: Holding[]
  renda_passiva_mensal: number
  receita_mes_atual: number
  coast_fi_config: CoastFiConfig
  history: EvolutionPoint[]
}

// Coast FI: número de FI = gasto anual desejado / taxa de retirada segura;
// Coast FI hoje = número de FI / (1+retorno real esperado)^(idade aposentadoria - idade atual).
function computeCoastFi(config: CoastFiConfig, patrimonioAtual: number) {
  const numeroFi = config.gasto_anual_desejado / config.taxa_retirada_segura
  const anos = config.idade_aposentadoria - config.idade_atual
  const coastFiHoje = numeroFi / Math.pow(1 + config.retorno_real_esperado, anos)
  const progresso = coastFiHoje > 0 ? Math.min(patrimonioAtual / coastFiHoje, 1) : 0
  return { coastFiHoje, progresso }
}

export default function PatrimonioPage() {
  const [data, setData] = useState<Investments | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Seletor só visual, mesma decisão de 2026-09-16 da Visão Geral — evita
  // precisar recalcular a janela de 6 meses a partir de mais dado mock.
  const [month, setMonth] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/investments/${CURRENT_USER_ID}`)
        const json = await res.json()
        if (!cancelled) setData(json.data)
      } catch {
        if (!cancelled) setError('Não foi possível carregar o patrimônio.')
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

  if (error || !data || !data.holdings?.length) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {error || 'Nenhum dado de patrimônio disponível.'}
      </div>
    )
  }

  const total = data.holdings.reduce((sum, h) => sum + h.current_value, 0)
  const withAllocation = [...data.holdings]
    .sort((a, b) => b.current_value - a.current_value)
    .map((h, index) => ({
      ...h,
      actual_pct: total > 0 ? h.current_value / total : 0,
      delta_value: h.target_allocation * total - h.current_value,
      opacity: OPACITY_BY_RANK[index] ?? OPACITY_BY_RANK[OPACITY_BY_RANK.length - 1],
    }))
  const mostOffTarget = [...withAllocation].sort(
    (a, b) => Math.abs(b.delta_value) - Math.abs(a.delta_value)
  )[0]
  const { coastFiHoje, progresso } = computeCoastFi(data.coast_fi_config, total)
  const history = data.history
  const prevMonthTotal = history.length > 1 ? history[history.length - 2].total : null
  const deltaPct = prevMonthTotal ? ((total - prevMonthTotal) / prevMonthTotal) * 100 : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Patrimônio</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Patrimônio total</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={total} /></CardTitle>
          </CardHeader>
          {deltaPct !== null && (
            <CardContent>
              <span className={deltaPct >= 0 ? 'text-xs font-medium text-positive' : 'text-xs font-medium text-destructive'}>
                {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs. {formatMonth(history[history.length - 2].month)}
              </span>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Renda passiva</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={data.renda_passiva_mensal} /></CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Por mês, sem aportes</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Receita do mês</CardDescription>
            <CardTitle className="text-2xl"><MoneyValue value={data.receita_mes_atual} /></CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Dividendos, aluguéis e juros</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Independência financeira · Coast FI</CardDescription>
            <Badge className="w-fit">Em progresso</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${Math.min(progresso * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {(progresso * 100).toFixed(1)}% do Coast FI necessário (<MoneyValue value={coastFiHoje} />) pra se aposentar
              aos {data.coast_fi_config.idade_aposentadoria} com <MoneyValue value={data.coast_fi_config.gasto_anual_desejado / 12} />/mês.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Evolução Patrimonial</CardTitle>
              <CardDescription>
                Mostrando {formatMonth(data.history[0].month)} – {formatMonth(data.history[data.history.length - 1].month)}
              </CardDescription>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Ver histórico ›</span>
          </div>
        </CardHeader>
        <CardContent>
          <EvolutionChart points={data.history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Carteira de investimentos</CardTitle>
              <CardDescription>Alocação atual vs. alvo por classe</CardDescription>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Abrir carteira ›</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-4">
            {withAllocation.map((h) => (
              <li key={h.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 text-secondary-foreground">
                    <span className="size-2 shrink-0 rounded-full bg-foreground" style={{ opacity: h.opacity }} />
                    {h.class}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      alvo {(h.target_allocation * 100).toFixed(0)}%
                    </span>
                    <span className="font-medium text-foreground">{(h.actual_pct * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.min(h.actual_pct * 100, 100)}%`, opacity: h.opacity }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rebalanceamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{mostOffTarget.class}</span> está{' '}
            {mostOffTarget.delta_value >= 0 ? 'abaixo' : 'acima'} do alvo — considere{' '}
            {mostOffTarget.delta_value >= 0 ? 'aportar' : 'realocar'} cerca de{' '}
            <span className="font-medium text-foreground">
              <MoneyValue value={Math.abs(mostOffTarget.delta_value)} />
            </span>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
