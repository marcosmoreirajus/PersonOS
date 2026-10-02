'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Briefcase,
  CalendarDays,
  PanelLeft,
  Plane,
  Settings,
  Target,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'

import {
  AnimatedSidebar,
  AnimatedSidebarClose,
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
        {/* Cabeçalho no molde do demo do beUI (logo + nome que some ao
            recolher + X só no celular), com o botão de recolher aqui dentro,
            a pedido do Marco (02/10). Recolhida, a linha vira coluna para o
            botão caber abaixo do logo. */}
        <AnimatedSidebarHeader className="p-3 pb-2">
          <div className="flex min-h-11 items-center gap-3 overflow-hidden px-2 group-data-[state=collapsed]/sidebar:flex-col group-data-[state=collapsed]/sidebar:gap-2 group-data-[state=collapsed]/sidebar:px-0">
            <Link
              href="/"
              aria-label="PersonOS — início"
              className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground text-sm font-semibold text-background">
                P
              </span>
              <span className="truncate text-sm font-semibold text-foreground group-data-[state=collapsed]/sidebar:hidden">
                PersonOS
              </span>
            </Link>
            <SidebarCollapseButton />
            <AnimatedSidebarClose
              aria-label="Fechar menu"
              className="ml-auto size-8 text-muted-foreground hover:bg-muted md:hidden"
            >
              <X aria-hidden="true" className="size-4" />
            </AnimatedSidebarClose>
          </div>
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
 * Recolher/expandir, dentro do cabeçalho da sidebar (só desktop; no celular
 * a sidebar é gaveta e fecha pelo X). Ícone e estilo do trigger do demo do
 * beUI: `PanelLeft`, cinza, fundo `muted` no hover. Atalho: Ctrl+B (⌘B no
 * Mac), já tratado pelo provider.
 */
function SidebarCollapseButton() {
  const { open, toggleSidebar } = useAnimatedSidebar()
  const rotulo = open ? 'Recolher menu' : 'Expandir menu'
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={rotulo}
      aria-expanded={open}
      title={`${rotulo} (Ctrl+B)`}
      className="ml-auto hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:inline-flex group-data-[state=collapsed]/sidebar:ml-0"
    >
      <PanelLeft aria-hidden="true" className="size-4" />
    </button>
  )
}

/**
 * Abre a sidebar no celular, onde ela vira gaveta e some da tela. No
 * desktop o botão de recolher mora dentro da própria sidebar
 * (`SidebarCollapseButton`), então este fica escondido a partir de `md`.
 * O trigger do beUI não desenha nada sozinho — por isso o ícone aqui.
 */
export function AppSidebarTrigger() {
  return (
    <AnimatedSidebarTrigger
      aria-label="Abrir menu"
      title="Abrir menu"
      className="size-9 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
    >
      <PanelLeft aria-hidden="true" className="size-4" />
    </AnimatedSidebarTrigger>
  )
}
