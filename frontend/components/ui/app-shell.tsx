'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Briefcase,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from '@/components/motion/animated-sidebar'
import { cookieDaSidebar } from '@/lib/sidebar'
import { cn } from '@/lib/utils'

type Modulo = {
  href: string
  label: string
  icon: LucideIcon
  /** Módulo previsto no roadmap mas ainda sem tela. */
  breve?: boolean
}

/**
 * Módulos do PersonOS — o primeiro nível da navegação.
 *
 * A lista inclui o que ainda não existe, desabilitado: o roadmap "tudo-em-um"
 * foi o argumento que levou à sidebar em vez de menu corrido (decisão de
 * 14/09), e esconder os módulos futuros tiraria justamente a informação que
 * justifica a escolha. O que não existe não é clicável.
 */
const MODULOS: Modulo[] = [
  { href: '/finance', label: 'Finanças', icon: Wallet },
  { href: '/business', label: 'Negócio', icon: Briefcase },
  { href: '/tarefas', label: 'Tarefas', icon: CalendarDays, breve: true },
  { href: '/metas', label: 'Metas', icon: Target, breve: true },
  { href: '/milhas', label: 'Milhas', icon: Plane, breve: true },
]

/**
 * Casca da aplicação: sidebar de módulos + área de conteúdo.
 *
 * Navegação em dois níveis (decisão de 14/09): a **sidebar troca de módulo**;
 * as seções de dentro de um módulo ficam em **tabs no topo**, não aqui. Com
 * seis módulos previstos, um menu corrido quebraria linha; e misturar os dois
 * níveis na mesma barra faria "Transações" parecer irmã de "Negócio".
 *
 * Substitui as sidebars que cada módulo mantinha por conta própria — a
 * inconsistência anotada na própria decisão de 14/09.
 */
export function AppShell({ children, sidebarOpen = true }: { children: ReactNode; sidebarOpen?: boolean }) {
  const pathname = usePathname()

  return (
    <AnimatedSidebarProvider
      // O layout do módulo lê o cookie no servidor e entrega o estado certo
      // já no primeiro HTML; aqui só se grava a escolha nova (ver lib/sidebar.ts).
      defaultOpen={sidebarOpen}
      onOpenChange={(aberta) => {
        document.cookie = cookieDaSidebar(aberta)
      }}
    >
      <AnimatedSidebar collapsible="icon" ariaLabel="Módulos">
        <AnimatedSidebarHeader>
          <Link href="/" className="flex items-center gap-2 px-2 py-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">
              P
            </span>
            <span className="truncate text-sm font-semibold text-foreground">PersonOS</span>
          </Link>
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent>
          <AnimatedSidebarGroup>
            <AnimatedSidebarMenu>
              {MODULOS.map((m) => (
                <AnimatedSidebarMenuItem key={m.href}>
                  <AnimatedSidebarMenuButton
                    href={m.breve ? undefined : m.href}
                    icon={<m.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                    isActive={!m.breve && pathname.startsWith(m.href)}
                    disabled={m.breve}
                    badge={m.breve ? 'em breve' : undefined}
                  >
                    {m.label}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroup>
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter>
          {/* Configurações é global, não um módulo: fica no rodapé, separada
              da lista de módulos. O tema mora lá dentro (Aparência). */}
          <AnimatedSidebarMenu>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/configuracoes"
                icon={<Settings className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                isActive={pathname.startsWith('/configuracoes')}
              >
                Configurações
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </AnimatedSidebarMenu>
        </AnimatedSidebarFooter>

        <AnimatedSidebarRail aria-label="Recolher ou expandir o menu" title="Recolher ou expandir o menu (Ctrl+B)" />
      </AnimatedSidebar>

      <AnimatedSidebarInset>{children}</AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  )
}

export type TabItem = {
  href: string
  label: string
  icon?: LucideIcon
  /** Contador ao lado do rótulo; zero ou ausente não mostra nada. */
  count?: number
}

/**
 * Tabs de seção — o segundo nível, dentro de um módulo.
 *
 * `exact` existe porque a raiz do módulo (`/finance`) é prefixo de todas as
 * outras; sem isso "Visão geral" ficaria sempre ativa.
 */
export function SectionTabs({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn('flex min-w-0 gap-1 overflow-x-auto', className)} aria-label="Seções do módulo">
      {items.map((item, i) => {
        const exact = i === 0
        const active = exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors',
              active
                ? 'bg-foreground font-medium text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {item.icon && <item.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />}
            {item.label}
            {item.count ? (
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-xs font-medium tabular-nums',
                  active ? 'bg-background/20 text-background' : 'bg-muted text-foreground'
                )}
              >
                {item.count > 99 ? '99+' : item.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Botão de recolher/expandir a sidebar, no cabeçalho de cada módulo.
 *
 * O trigger do componente base não desenha nada — era um botão vazio e
 * invisível no cabeçalho. No celular a sidebar vira gaveta, então o mesmo
 * botão abre o menu. Atalho: Ctrl+B (⌘B no Mac), já tratado pelo provider.
 */
export function AppSidebarTrigger() {
  const { isMobile, open } = useAnimatedSidebar()
  const rotulo = isMobile ? 'Abrir menu' : open ? 'Recolher menu' : 'Expandir menu'
  const Icon = isMobile || !open ? PanelLeftOpen : PanelLeftClose

  return (
    <AnimatedSidebarTrigger
      aria-label={rotulo}
      title={isMobile ? rotulo : `${rotulo} (Ctrl+B)`}
      className="size-9 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </AnimatedSidebarTrigger>
  )
}
