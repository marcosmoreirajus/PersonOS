'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, CalendarClock, PieChart, PiggyBank } from 'lucide-react'

import { SidebarItem } from '@/components/ui/sidebar-item'

const NAV_ITEMS = [
  { href: '/finance', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/finance/agendadas', label: 'Agendadas', icon: CalendarClock },
  { href: '/finance/relatorios', label: 'Relatórios', icon: PieChart },
  { href: '/finance/patrimonio', label: 'Patrimônio', icon: PiggyBank },
]

export default function FinanceNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <SidebarItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href}
        />
      ))}
    </nav>
  )
}
