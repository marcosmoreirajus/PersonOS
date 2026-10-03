'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, ChevronRight, CircleAlert, type LucideIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MoneyValue } from '@/components/ui/money-value'
import {
  PREFERENCIAS_PADRAO,
  contarNaoVistos,
  derivarAvisos,
  paresDe,
  tituloAVencer,
  tituloEmAtraso,
  type Aviso,
  type LancamentoAviso,
  type Preferencias,
  type TipoAviso,
} from '@/lib/avisos'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { hojeLocal } from '@/lib/dates'

/** O que cada aviso mostra; a regra de quem entra mora em `lib/avisos.ts`. */
const APRESENTACAO: Record<
  TipoAviso,
  { icon: LucideIcon; titulo: (a: Aviso, p: Preferencias) => string; descricao: string; href: string; urgente?: boolean }
> = {
  em_atraso: {
    icon: CircleAlert,
    titulo: (a) => tituloEmAtraso(a.ids.length),
    descricao: 'Vencidos e ainda sem baixa.',
    href: '/finance/transactions',
    urgente: true,
  },
  a_vencer: {
    icon: CalendarClock,
    titulo: (a, p) => tituloAVencer(a.ids.length, p.janela_a_vencer),
    descricao: 'Contas e recebimentos em aberto.',
    href: '/finance/agendadas',
  },
}

/**
 * Sino de avisos no cabeçalho de Finanças, ao lado do olho.
 *
 * Só prazos (GLOSSARY.md: "Aviso"). O número conta lançamentos ainda não
 * vistos; "Marcar como visto" é explícito — abrir o sino para olhar não
 * apaga o lembrete. Configuração e visto vêm do backend, então valem em
 * qualquer aparelho.
 */
export function NotificationsBell() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [lancamentos, setLancamentos] = useState<LancamentoAviso[]>([])
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS_PADRAO)
  // Enquanto recarrega, "Marcar como visto" gravaria o retrato antigo e os
  // pares que chegassem em seguida voltariam a contar.
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // Degrada em silêncio de propósito: sem estes dados o sino só fica sem
      // contador, e o contador ausente não é informação — as telas mostram o
      // erro de carga de verdade.
      const [tx, prefs] = await Promise.all([
        api<LancamentoAviso[]>(`/api/transactions/user/${CURRENT_USER_ID}`).catch(() => []),
        api<Preferencias>(`/api/preferences/user/${CURRENT_USER_ID}`).catch(() => null),
      ])
      setLancamentos(tx)
      if (prefs) setPrefs(prefs)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Recarrega a cada troca de tela e ao abrir: dar baixa em outra tela, ou
  // mudar a configuração, precisa refletir no contador sem recarregar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados: o único setState síncrono é o indicador `carregando`; o resto vem depois do await
    carregar()
  }, [carregar, pathname])

  const avisos = useMemo(() => derivarAvisos(lancamentos, prefs, hojeLocal()), [lancamentos, prefs])
  const naoVistos = contarNaoVistos(avisos, prefs.visto)

  async function marcarComoVisto() {
    const visto = paresDe(avisos)
    setPrefs((p) => ({ ...p, visto }))
    try {
      setPrefs(
        await api<Preferencias>(`/api/preferences/user/${CURRENT_USER_ID}`, { method: 'PATCH', body: { visto } })
      )
    } catch {
      // Não gravou: recarregar devolve o número — melhor que fingir que foi
      // salvo e ver o número voltar no próximo aparelho.
      carregar()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) carregar()
      }}
    >
      <PopoverTrigger
        aria-label={naoVistos > 0 ? `Avisos: ${naoVistos} não vistos` : 'Avisos: nada novo'}
        title="Avisos"
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground data-popup-open:text-foreground"
      >
        <Bell className="size-4" />
        {naoVistos > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums"
          >
            {naoVistos > 99 ? '99+' : naoVistos}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 gap-1 p-1.5">
        <p className="px-2.5 pt-1.5 pb-1 text-sm font-semibold text-foreground">Avisos</p>
        {avisos.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">Tudo em dia.</p>
        ) : (
          <ul className="flex flex-col">
            {avisos.map((a) => {
              const apresentacao = APRESENTACAO[a.tipo]
              const Icon = apresentacao.icon
              return (
                <li key={a.tipo}>
                  <Link
                    href={apresentacao.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted',
                        apresentacao.urgente ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium text-foreground">{apresentacao.titulo(a, prefs)}</span>
                      <span className="text-xs text-muted-foreground">{apresentacao.descricao}</span>
                      {(!!a.aPagar || !!a.aReceber) && (
                        <span className="flex flex-wrap gap-x-3 text-xs font-medium tabular-nums">
                          {!!a.aPagar && (
                            <span className={apresentacao.urgente ? 'text-destructive' : 'text-foreground'}>
                              <MoneyValue value={a.aPagar} /> a pagar
                            </span>
                          )}
                          {!!a.aReceber && (
                            <span className="text-positive">
                              <MoneyValue value={a.aReceber} /> a receber
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-2.5 pt-2 pb-1">
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Configurar avisos
          </Link>
          <button
            type="button"
            onClick={marcarComoVisto}
            disabled={naoVistos === 0 || carregando}
            className="text-xs font-medium text-foreground hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
          >
            Marcar como visto
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
