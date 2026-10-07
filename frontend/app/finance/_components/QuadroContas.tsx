'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'

import { TiltCard } from '@/components/motion/tilt-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonLinhas } from '@/components/ui/carregando'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { logoDaConta } from '@/lib/conta-logos'
import type { Cartao } from '../cartoes/_components/CartaoDialog'
import { LogoConta } from './LogoConta'
import { TileConta } from './TileConta'
import { useContas } from './useContas'

const PAGINA = '/finance/contas'

/** Todo tile do carrossel é igual: inclina ao passar o mouse e leva à página completa. */
const LINK_TILE =
  'block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

/**
 * Rolagem do carrossel sem a barra nativa: diz se há mais para cada lado (as
 * setas e o esmaecer das bordas dependem disso) e rola de página em página.
 * Reavalia ao rolar, ao redimensionar e quando os itens mudam.
 */
function useRolagem(itens: number) {
  const lista = useRef<HTMLUListElement>(null)
  const [pode, setPode] = useState({ esquerda: false, direita: false })

  const medir = useCallback(() => {
    const el = lista.current
    if (!el) return
    const esquerda = el.scrollLeft > 4
    const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setPode((p) => (p.esquerda === esquerda && p.direita === direita ? p : { esquerda, direita }))
  }, [])

  useEffect(() => {
    const el = lista.current
    if (!el) return
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [medir, itens])

  const rolar = (sentido: 1 | -1) =>
    lista.current?.scrollBy({ left: sentido * lista.current.clientWidth * 0.8, behavior: 'smooth' })

  return { lista, pode, medir, rolar }
}

/** Esmaece só a borda por onde ainda há conteúdo, em vez de cortar o tile no meio. */
function mascaraDasBordas(pode: { esquerda: boolean; direita: boolean }): string | undefined {
  if (!pode.esquerda && !pode.direita) return undefined
  const ini = pode.esquerda ? 'transparent 0, #000 2rem' : '#000 0'
  const fim = pode.direita ? '#000 calc(100% - 2rem), transparent 100%' : '#000 100%'
  return `linear-gradient(to right, ${ini}, ${fim})`
}

/**
 * Quadro "Contas e cartões" da Visão Geral: uma fileira que rola para o lado,
 * com contas, "Sem conta" (quando houver) e cartões. A altura é fixa — o card
 * não cresce com o número de contas, e a barra de rolagem nativa não aparece: setas no
 * cabeçalho e o esmaecer das bordas dizem que há mais para o lado — e o total não se repete aqui: o Saldo
 * grande ao lado já é o Saldo Geral. Aqui só se olha: cada tile leva à página completa,
 * onde se cadastra e edita contas e cartões. Carrega e falha sozinho.
 */
export function QuadroContas({ className }: { className?: string }) {
  const { saldos, contas, erro } = useContas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const { lista, pode, medir, rolar } = useRolagem((saldos?.accounts.length ?? 0) + cartoes.length)

  useEffect(() => {
    let cancelled = false
    // Os cartões só completam a fileira: sem eles o quadro segue com as contas.
    api<Cartao[]>(`/api/cards/user/${CURRENT_USER_ID}`)
      .then((lista) => !cancelled && setCartoes(lista))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const vazio = saldos !== null && saldos.accounts.length === 0 && cartoes.length === 0

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Contas e cartões</CardTitle>
            <CardDescription>Use as setas para ver todas.</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link href={PAGINA} className="mr-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              Ver tudo ›
            </Link>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Ver contas anteriores"
              disabled={!pode.esquerda}
              onClick={() => rolar(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Ver mais contas"
              disabled={!pode.direita}
              onClick={() => rolar(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {erro ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </div>
        ) : saldos === null ? (
          <SkeletonLinhas linhas={2} />
        ) : vazio ? (
          // Sem nada cadastrado, tudo estaria em "Sem conta": o convite basta.
          <p className="text-sm text-muted-foreground">
            Cadastre suas contas e cartões em{' '}
            <Link href={PAGINA} className="font-medium text-foreground underline underline-offset-2">
              Contas e cartões
            </Link>
            .
          </p>
        ) : (
          <ul
            ref={lista}
            onScroll={medir}
            style={{ maskImage: mascaraDasBordas(pode), WebkitMaskImage: mascaraDasBordas(pode) }}
            className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Contas e cartões"
          >
            {saldos.accounts.map((c) => (
              <li key={c.account_id} className="w-56 shrink-0 snap-start">
                <Link href={PAGINA} className={LINK_TILE}>
                  <TileConta linha={c} completa={contas.find((x) => x.id === c.account_id)} className="h-full" />
                </Link>
              </li>
            ))}
            {saldos.no_account && (
              <li className="w-56 shrink-0 snap-start">
                <Link href={PAGINA} className={LINK_TILE}>
                  <TiltCard className="h-full border border-dashed border-border">
                    <div className="flex flex-col gap-4 p-4">
                      <span className="text-sm text-muted-foreground">Sem conta</span>
                      <MoneyValue value={saldos.no_account.balance} className="text-xl font-bold" />
                    </div>
                  </TiltCard>
                </Link>
              </li>
            )}
            {cartoes.map((c) => (
              <li key={`cartao-${c.id}`} className="w-56 shrink-0 snap-start">
                <Link href={PAGINA} className={LINK_TILE}>
                  <TiltCard className="h-full border border-border bg-background">
                    <div className="flex flex-col gap-4 p-4">
                      <div className="flex items-center gap-3">
                        {logoDaConta(c.logo) ? (
                          <LogoConta logo={c.logo} />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <CreditCard className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                          <span className="text-xs text-muted-foreground">Cartão de crédito</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <MoneyValue value={c.limit} className="text-xl font-bold" />
                        <span className="text-xs text-muted-foreground">Limite</span>
                      </div>
                    </div>
                  </TiltCard>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

    </Card>
  )
}
