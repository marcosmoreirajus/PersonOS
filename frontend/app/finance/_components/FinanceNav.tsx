'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight } from 'lucide-react'

import { SidebarItem } from '@/components/ui/sidebar-item'

const NAV_ITEMS = [
  { href: '/finance', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transações', icon: ArrowLeftRight },
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
