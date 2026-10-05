'use client'

import { useEffect, useState } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue, useValuesHidden } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { formatDateBR } from '@/lib/dates'
import { escalaDoEixo, semMovimento, type PontoTendencia } from '@/lib/relatorios-tendencia'
import type { PeriodoEscolhido } from '@/lib/relatorios-periodo'

/** Resposta de `GET /api/reports/trend/{id}` (ver docs/finance/spec.md). */
type RespostaTendencia = {
  periodo: { atalho: string; de: string; ate: string; aberto: boolean }
  granularidade: 'dia' | 'mes'
  pontos: PontoTendencia[]
}

const LARGURA = 640
const ALTURA = 240
const MARGEM = { topo: 12, direita: 12, baixo: 28, esquerda: 56 }
const COR_RECEITA = 'var(--positive)'
const COR_DESPESA = 'var(--terracotta)'
const COR_RESULTADO = 'var(--foreground)'

/** Rótulo curto do eixo; com a privacidade ligada não mostra número nenhum. */
function rotuloDoEixo(valor: number, oculto: boolean): string {
  if (oculto) return '••••'
  return valor.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
}

function Grafico({ pontos }: { pontos: PontoTendencia[] }) {
  const { hidden } = useValuesHidden()
  const [ativo, setAtivo] = useState<number | null>(null)

  const eixo = escalaDoEixo(pontos)
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo
  const y = (v: number) => MARGEM.topo + ((eixo.max - v) / (eixo.max - eixo.min)) * alturaUtil
  const faixa = larguraUtil / pontos.length
  const largBarra = Math.min(18, faixa * 0.36)
  const centro = (i: number) => MARGEM.esquerda + faixa * (i + 0.5)
  // No máximo uns 10 rótulos no eixo: pula os intermediários quando há muitos pontos.
  const passoRotulo = Math.ceil(pontos.length / 10)

  const linha = pontos.map((p, i) => `${centro(i)},${y(p.resultado)}`).join(' ')
  const mostrado = ativo === null ? null : pontos[ativo]

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Receita, despesa e resultado ao longo do período">
        {eixo.marcas.map((m) => (
          <g key={m}>
            <line
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={y(m)}
              y2={y(m)}
              stroke="var(--border)"
              strokeWidth={m === 0 ? 1.5 : 1}
            />
            <text x={MARGEM.esquerda - 8} y={y(m)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted-foreground)">
              {rotuloDoEixo(m, hidden)}
            </text>
          </g>
        ))}

        {pontos.map((p, i) => (
          <g key={p.chave}>
            {ativo === i && <rect x={MARGEM.esquerda + faixa * i} y={MARGEM.topo} width={faixa} height={alturaUtil} fill="var(--muted)" opacity={0.6} />}
            <rect
              x={centro(i) - largBarra - 1}
              y={y(p.receita)}
              width={largBarra}
              height={Math.max(y(0) - y(p.receita), 0)}
              fill={COR_RECEITA}
              rx={2}
            />
            <rect x={centro(i) + 1} y={y(p.despesa)} width={largBarra} height={Math.max(y(0) - y(p.despesa), 0)} fill={COR_DESPESA} rx={2} />
            {i % passoRotulo === 0 && (
              <text x={centro(i)} y={ALTURA - 8} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                {p.rotulo}
              </text>
            )}
          </g>
        ))}

        {pontos.length > 1 && <polyline points={linha} fill="none" stroke={COR_RESULTADO} strokeWidth={2} strokeLinejoin="round" />}
        {pontos.map((p, i) => (
          <circle key={p.chave} cx={centro(i)} cy={y(p.resultado)} r={ativo === i ? 4 : 2.5} fill={COR_RESULTADO} />
        ))}

        {/* Faixas de toque/foco por ponto, por cima de tudo. */}
        {pontos.map((p, i) => (
          <rect
            key={p.chave}
            x={MARGEM.esquerda + faixa * i}
            y={MARGEM.topo}
            width={faixa}
            height={alturaUtil}
            fill="transparent"
            tabIndex={0}
            aria-label={`${p.rotulo}: receita ${p.receita}, despesa ${p.despesa}, resultado ${p.resultado}`.replace(/[0-9]/g, hidden ? '•' : '$&')}
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            onFocus={() => setAtivo(i)}
            onBlur={() => setAtivo(null)}
            className="outline-none"
          />
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: COR_RECEITA }} />
            Receita
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: COR_DESPESA }} />
            Despesa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3" style={{ background: COR_RESULTADO }} />
            Resultado
          </span>
        </div>
        <div className="min-h-5 text-sm text-foreground">
          {mostrado ? (
            <>
              <span className="font-medium">
                {mostrado.de === mostrado.ate ? formatDateBR(mostrado.de) : mostrado.rotulo}
              </span>
              {' · '}receita <MoneyValue value={mostrado.receita} /> · despesa <MoneyValue value={mostrado.despesa} /> · resultado{' '}
              <MoneyValue value={mostrado.resultado} />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Passe o mouse sobre uma barra para ver os valores.</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Tendência do período escolhido: barras de receita e despesa e a linha do
 * resultado, por dia (até 31 dias) ou por mês. Só o passado; a Projeção vem
 * em outro ticket. O pedido espera o período pronto (`chave`), sem setState
 * dentro do efeito.
 */
export function Tendencia({ periodo, hoje, pronto }: { periodo: PeriodoEscolhido; hoje: string; pronto: boolean }) {
  const chave = `${periodo.atalho}|${periodo.de}|${periodo.ate}`
  const [resposta, setResposta] = useState<{ chave: string; dados: RespostaTendencia | null; erro: string | null } | null>(null)
  const atual = resposta?.chave === chave ? resposta : null

  useEffect(() => {
    if (!pronto) return
    let cancelled = false
    api<RespostaTendencia>(`/api/reports/trend/${CURRENT_USER_ID}`, {
      query: { periodo: periodo.atalho, hoje, de: periodo.de, ate: periodo.ate },
    })
      .then((dados) => {
        if (!cancelled) setResposta({ chave, dados, erro: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResposta({ chave, dados: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar a tendência.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [periodo, hoje, pronto, chave])

  let corpo
  if (!pronto) {
    corpo = <p className="text-sm text-muted-foreground">Escolha a data inicial e a final.</p>
  } else if (!atual) {
    corpo = <p className="text-muted-foreground">Carregando...</p>
  } else if (atual.erro || !atual.dados) {
    corpo = (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {atual.erro || 'Nenhum dado disponível.'}
      </div>
    )
  } else if (semMovimento(atual.dados.pontos)) {
    corpo = <p className="text-sm text-muted-foreground">Sem lançamentos neste período.</p>
  } else {
    corpo = <Grafico pontos={atual.dados.pontos} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendência</CardTitle>
        <CardDescription>
          Receita e despesa{atual?.dados ? (atual.dados.granularidade === 'dia' ? ' por dia' : ' por mês') : ''}, com o resultado em linha.
        </CardDescription>
      </CardHeader>
      <CardContent>{corpo}</CardContent>
    </Card>
  )
}
