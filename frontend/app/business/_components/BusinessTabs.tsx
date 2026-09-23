'use client'

import { Banknote, Compass, Rocket, User } from 'lucide-react'

import { SectionTabs, type TabItem } from '@/components/ui/app-shell'

/** Seções do módulo Negócio — mesmo padrão de Finanças (ver FinanceTabs). */
const SECOES: TabItem[] = [
  { href: '/business/founder', label: 'Founder', icon: User },
  { href: '/business/direction', label: 'Direção', icon: Compass },
  { href: '/business/validation', label: 'Validação', icon: Rocket },
  { href: '/business/caixa', label: 'Caixa', icon: Banknote },
]

export default function BusinessTabs() {
  return <SectionTabs items={SECOES} />
}
