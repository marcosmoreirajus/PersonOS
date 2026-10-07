'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PeriodSelector } from './_components/PeriodSelector'
import { DespesasPorCategoria } from './_components/DespesasPorCategoria'
import { MaioresGastos } from './_components/MaioresGastos'
import { Tendencia } from './_components/Tendencia'
import { AbasRelatorios } from './_components/AbasRelatorios'
import { Parcelados } from './_components/Parcelados'
import { ResultCards, type ResumoPeriodo } from './_components/ResultCards'
import { Carregando } from '@/components/ui/carregando'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { hojeLocal } from '@/lib/dates'
import { lerAba, montarBuscaRelatorios, type Aba } from '@/lib/relatorios-parcelados'
import { lerPeriodo, type PeriodoEscolhido } from '@/lib/relatorios-periodo'

function RelatoriosContent() {
  const busca = useSearchParams()
  const [periodo, setPeriodo] = useState<PeriodoEscolhido>(() => lerPeriodo(busca))
  const [aba, setAba] = useState<Aba>(() => lerAba(busca))
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
    const novaBusca = montarBuscaRelatorios(aba, periodo)
    if (novaBusca !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + novaBusca)
    }
  }, [periodo, aba])

  useEffect(() => {
    if (incompleto || aba === 'parcelados') return
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
  }, [periodo, hoje, incompleto, chave, aba])

  const cabecalho = (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
      <AbasRelatorios aba={aba} onChange={setAba} />
    </>
  )

  // Parcelados não depende do período: só o cabeçalho e a aba.
  if (aba === 'parcelados') {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <Parcelados hoje={hoje} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      <PeriodSelector periodo={periodo} onChange={setPeriodo} rascunho={rascunho} onRascunho={setRascunho} />

      {incompleto ? (
        <p className="text-muted-foreground">Escolha a data inicial e a final.</p>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : loading || !resumo ? (
        <Carregando />
      ) : (
        <ResultCards resumo={resumo} />
      )}

      <Tendencia periodo={periodo} hoje={hoje} pronto={!incompleto} />

      <DespesasPorCategoria periodo={periodo} hoje={hoje} pronto={!incompleto} />

      <MaioresGastos periodo={periodo} hoje={hoje} pronto={!incompleto} />
    </div>
  )
}

// `useSearchParams` precisa de um limite de Suspense para a página poder ser
// gerada estaticamente (o mesmo cuidado de "A revisar" e de Transações).
export default function RelatoriosPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <RelatoriosContent />
    </Suspense>
  )
}
