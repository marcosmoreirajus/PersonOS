'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeftRight, CalendarClock, ListChecks, LayoutDashboard, PieChart, PiggyBank } from 'lucide-react'

import { SectionTabs, type TabItem } from '@/components/ui/app-shell'
import { CURRENT_USER_ID, api } from '@/lib/api'

/** Evento que a tela "A revisar" dispara ao resolver um item. */
export const REVIEW_CHANGED_EVENT = 'finance:review-changed'

/**
 * Seções do módulo Finanças — segundo nível da navegação.
 *
 * Saíram da sidebar e vieram para o topo na decisão de 14/09: a sidebar é
 * para trocar de **módulo**. Enquanto as seções moravam nela, "Transações"
 * aparecia no mesmo nível hierárquico que "Negócio".
 *
 * A lista vive num componente client, e não no layout: ícone do lucide é uma
 * função, e função não atravessa a fronteira server → client.
 *
 * "A revisar" (Fatia 4) carrega o tamanho da fila. O rótulo é esse e nunca
 * "Pendências", que é das contas do mês em Agendadas — ver GLOSSARY.md.
 */
const SECOES: TabItem[] = [
  { href: '/finance', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/finance/agendadas', label: 'Agendadas', icon: CalendarClock },
  { href: '/finance/relatorios', label: 'Relatórios', icon: PieChart },
  { href: '/finance/patrimonio', label: 'Patrimônio', icon: PiggyBank },
  { href: '/finance/revisar', label: 'A revisar', icon: ListChecks },
]

export default function FinanceTabs() {
  const pathname = usePathname()
  const [aRevisar, setARevisar] = useState(0)

  // Recarrega a cada troca de tela e quando a fila avisa que mudou:
  // importar ou categorizar em outra tela precisa refletir no contador.
  useEffect(() => {
    let cancelled = false
    async function carregar() {
      try {
        const fila = await api<{ total?: number }>(`/api/review/user/${CURRENT_USER_ID}`)
        if (!cancelled) setARevisar(fila.total ?? 0)
      } catch {
        // Sem dados a aba só fica sem contador; a tela mostra o erro de carga.
      }
    }
    carregar()
    window.addEventListener(REVIEW_CHANGED_EVENT, carregar)
    return () => {
      cancelled = true
      window.removeEventListener(REVIEW_CHANGED_EVENT, carregar)
    }
  }, [pathname])

  const itens = SECOES.map((s) => (s.href === '/finance/revisar' ? { ...s, count: aRevisar } : s))
  return <SectionTabs items={itens} />
}
