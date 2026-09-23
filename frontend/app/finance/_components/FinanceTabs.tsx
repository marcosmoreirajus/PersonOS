'use client'

import { ArrowLeftRight, CalendarClock, LayoutDashboard, PieChart, PiggyBank } from 'lucide-react'

import { SectionTabs, type TabItem } from '@/components/ui/app-shell'

/**
 * Seções do módulo Finanças — segundo nível da navegação.
 *
 * Saíram da sidebar e vieram para o topo na decisão de 14/09: a sidebar é
 * para trocar de **módulo**. Enquanto as seções moravam nela, "Transações"
 * aparecia no mesmo nível hierárquico que "Negócio".
 *
 * A lista vive num componente client, e não no layout: ícone do lucide é uma
 * função, e função não atravessa a fronteira server → client.
 */
const SECOES: TabItem[] = [
  { href: '/finance', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/finance/agendadas', label: 'Agendadas', icon: CalendarClock },
  { href: '/finance/relatorios', label: 'Relatórios', icon: PieChart },
  { href: '/finance/patrimonio', label: 'Patrimônio', icon: PiggyBank },
]

export default function FinanceTabs() {
  return <SectionTabs items={SECOES} />
}
