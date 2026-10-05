'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CategoryBreakdown, rankWithUncategorized, REVISAR_SEM_CATEGORIA } from '../../_components/CategoryBreakdown'
import type { Cartao } from './ResultCards'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { categoryColorByRank } from '@/lib/category-colors'
import { hrefCategoria } from '@/lib/relatorios-categorias'
import { textoPercentual, type PeriodoEscolhido } from '@/lib/relatorios-periodo'

type CategoriaPeriodo = Cartao & { category_id: number; nome: string }

/** Resposta de `GET /api/reports/categories/{id}` (ver docs/finance/spec.md). */
type RespostaCategorias = {
  periodo: { atalho: string; de: string; ate: string; aberto: boolean }
  categorias: CategoriaPeriodo[]
  /** O balde virtual, fora da lista das reais; nulo se não há. */
  sem_categoria: Cartao | null
  total: number
  /** Inteiro, arredondado para cima, sobre `total`. */
  percentual_sem_categoria: number
}

function sinal(diferenca: number): string {
  return diferenca > 0 ? '+' : diferenca < 0 ? '−' : ''
}

/** "+25,0% · anterior R$ 100,00": o "—" aparece quando o anterior é zero. */
function Variacao({ cartao }: { cartao: Cartao }) {
  return (
    <>
      {textoPercentual(cartao.percentual)} ({sinal(cartao.diferenca)}
      <MoneyValue value={Math.abs(cartao.diferenca)} />) · anterior <MoneyValue value={cartao.anterior} />
    </>
  )
}

/**
 * Despesas por categoria do período escolhido, contra o anterior. Cada
 * categoria leva às Transações dela no mesmo período; o balde "Sem categoria"
 * leva a "A revisar". O pedido espera o período pronto (`chave`), sem setState
 * dentro do efeito.
 */
export function DespesasPorCategoria({ periodo, hoje, pronto }: { periodo: PeriodoEscolhido; hoje: string; pronto: boolean }) {
  const chave = `${periodo.atalho}|${periodo.de}|${periodo.ate}`
  const [resposta, setResposta] = useState<{ chave: string; dados: RespostaCategorias | null; erro: string | null } | null>(null)
  const atual = resposta?.chave === chave ? resposta : null

  useEffect(() => {
    if (!pronto) return
    let cancelled = false
    api<RespostaCategorias>(`/api/reports/categories/${CURRENT_USER_ID}`, {
      query: { periodo: periodo.atalho, hoje, de: periodo.de, ate: periodo.ate },
    })
      .then((dados) => {
        if (!cancelled) setResposta({ chave, dados, erro: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResposta({ chave, dados: null, erro: e instanceof Error ? e.message : 'Não foi possível carregar as despesas por categoria.' })
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
  } else {
    const { dados } = atual
    const intervalo = { de: dados.periodo.de, ate: dados.periodo.ate }
    const semCategoria = dados.sem_categoria
    if (dados.categorias.length === 0 && !semCategoria) {
      corpo = <p className="text-sm text-muted-foreground">Sem lançamentos neste período.</p>
    } else {
      const categoryData = rankWithUncategorized(
        dados.categorias.map((c) => ({
          name: c.nome,
          value: c.valor,
          href: hrefCategoria(c.category_id, intervalo),
          detail: <Variacao cartao={c} />,
        })),
        semCategoria?.valor ?? 0,
        categoryColorByRank,
        semCategoria ? <Variacao cartao={semCategoria} /> : undefined
      )
      corpo = (
        <>
          {semCategoria && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground">
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {/* Arredondado para cima no serviço: 0,4% sem categoria não pode aparecer como 0%. */}
              <span>
                {dados.percentual_sem_categoria}% das despesas (<MoneyValue value={semCategoria.valor} />) estão sem categoria.
              </span>
              <Link href={REVISAR_SEM_CATEGORIA} className="font-medium underline underline-offset-4">
                Classificar agora
              </Link>
            </p>
          )}
          <CategoryBreakdown data={categoryData} />
        </>
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por categoria</CardTitle>
        <CardDescription>Onde o dinheiro saiu no período, contra o anterior. Clique numa categoria para ver os lançamentos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{corpo}</CardContent>
    </Card>
  )
}
