'use client'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { formatDateBR } from '@/lib/dates'
import { textoPercentual } from '@/lib/relatorios-periodo'

export type Cartao = {
  valor: number
  anterior: number
  anterior_inteiro: number
  /** valor - anterior, em reais; existe mesmo sem percentual. */
  diferenca: number
  /** Nulo quando o anterior é zero ou vazio: a tela mostra "—". */
  percentual: number | null
}

type Janela = { de: string; ate: string }

export type ResumoPeriodo = {
  periodo: { atalho: string; de: string; ate: string; aberto: boolean }
  anterior: Janela
  anterior_inteiro: Janela
  receita: Cartao
  despesa: Cartao
  resultado: Cartao
}

function intervalo(j: Janela): string {
  return j.de === j.ate ? formatDateBR(j.de) : `${formatDateBR(j.de)} a ${formatDateBR(j.ate)}`
}

function sinal(diferenca: number): string {
  return diferenca > 0 ? '+' : diferenca < 0 ? '−' : ''
}

function CardResultado({
  titulo,
  cartao,
  resumo,
}: {
  titulo: string
  cartao: Cartao
  resumo: ResumoPeriodo
}) {
  // Período fechado: o anterior já é o inteiro, não repete.
  const mostraInteiro = resumo.periodo.aberto
  return (
    <Card>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl">
          <MoneyValue value={cartao.valor} />
        </CardTitle>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
          <span className="font-medium">{textoPercentual(cartao.percentual)}</span>
          <span className="text-muted-foreground">
            {sinal(cartao.diferenca)}
            <MoneyValue value={Math.abs(cartao.diferenca)} /> contra o período anterior
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Anterior ({intervalo(resumo.anterior)}): <MoneyValue value={cartao.anterior} />
        </p>
        {mostraInteiro && (
          <p className="text-xs text-muted-foreground">
            Anterior inteiro ({intervalo(resumo.anterior_inteiro)}): <MoneyValue value={cartao.anterior_inteiro} />
          </p>
        )}
      </CardHeader>
    </Card>
  )
}

/** Receita, Despesa e Resultado do período, cada um com a variação contra o anterior. */
export function ResultCards({ resumo }: { resumo: ResumoPeriodo }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{intervalo(resumo.periodo)}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardResultado titulo="Receita" cartao={resumo.receita} resumo={resumo} />
        <CardResultado titulo="Despesa" cartao={resumo.despesa} resumo={resumo} />
        <CardResultado titulo="Resultado" cartao={resumo.resultado} resumo={resumo} />
      </div>
    </div>
  )
}
