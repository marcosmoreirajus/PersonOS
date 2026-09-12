'use client'

import { useState } from 'react'
import {
  Home,
  Wallet,
  Target,
  Compass,
  Settings,
  Rocket,
} from 'lucide-react'

import { SidebarItem } from '@/components/ui/sidebar-item'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'
import { CardGrid } from '@/components/ui/card-grid'

const NAV_ITEMS = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'caixa', label: 'Caixa', icon: Wallet },
  { id: 'direcao', label: 'Direção', icon: Compass },
  { id: 'validacao', label: 'Validação', icon: Target },
  { id: 'founder', label: 'Founder', icon: Rocket },
  { id: 'config', label: 'Configurações', icon: Settings },
]

const FAKE_ITEMS = [
  {
    id: 1,
    title: 'Fluxo de caixa — Setembro',
    description: 'Entradas e saídas do mês, PJ + PF consolidadas.',
    tag: 'Caixa',
  },
  {
    id: 2,
    title: 'Meta: reserva de emergência',
    description: '6 meses de custo fixo guardados até dezembro.',
    tag: 'Direção',
  },
  {
    id: 3,
    title: 'Validar posicionamento Clari',
    description: 'Entrevistas com 5 potenciais usuários casal PJ+PF.',
    tag: 'Validação',
  },
  {
    id: 4,
    title: 'Pitch deck v0.2',
    description: 'Atualizar números após feedback dos investidores anjo.',
    tag: 'Founder',
  },
  {
    id: 5,
    title: 'Importar extrato OFX',
    description: 'Testar normalização automática com banco Nubank.',
    tag: 'Caixa',
  },
  {
    id: 6,
    title: 'Revisão de assinaturas',
    description: 'Cancelar serviços não usados nos últimos 60 dias.',
    tag: 'Direção',
  },
]

export default function DesignPreviewPage() {
  const [activeNav, setActiveNav] = useState('home')
  const [view, setView] = useState<ViewMode>('grid')

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar de exemplo */}
      <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-border p-4">
        <div className="mb-4 px-2">
          <p className="text-sm font-semibold tracking-tight">PersonOS</p>
          <p className="text-xs text-muted-foreground">Design system preview</p>
        </div>
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeNav === item.id}
            onClick={() => setActiveNav(item.id)}
          />
        ))}
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Design Preview</h1>
            <p className="text-sm text-muted-foreground">
              Componentes do design system — sidebar, cards e alternância de visualização.
            </p>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </header>

        <CardGrid view={view}>
          {FAKE_ITEMS.map((item) =>
            view === 'grid' ? (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {item.tag}
                  </span>
                </CardFooter>
              </Card>
            ) : (
              <Card key={item.id} className="flex-row items-center justify-between py-3">
                <CardContent className="flex flex-1 items-center gap-3">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {item.tag}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </CardGrid>
      </main>
    </div>
  )
}
