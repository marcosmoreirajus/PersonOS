'use client'

import { useRouter } from 'next/navigation'
import { PanelLeft, MousePointer2, type LucideIcon } from 'lucide-react'

import { criarPreferenciaDoNavegador } from '@/lib/hooks/use-preferencia-do-navegador'
import { SIDEBAR_MODE_COOKIE, cookieDoModo, escreverCookie, lerCookie, modoDaSidebar, type SidebarMode } from '@/lib/sidebar'
import { cn } from '@/lib/utils'

const useModoDaSidebar = criarPreferenciaDoNavegador<SidebarMode>({
  ler: () => modoDaSidebar(lerCookie(SIDEBAR_MODE_COOKIE)),
  gravar: (modo) => escreverCookie(cookieDoModo(modo)),
  servidor: 'fixo',
})

const OPTIONS: { value: SidebarMode; icon: LucideIcon; label: string; hint: string }[] = [
  { value: 'fixo', icon: PanelLeft, label: 'Fixo', hint: 'Recolhe e expande pelo botão, e fica como você deixou' },
  { value: 'auto', icon: MousePointer2, label: 'Automático', hint: 'Fica recolhido e expande ao passar o mouse' },
]

/**
 * Modo do menu lateral — mesmo formato de pílula do `ThemeToggle`, ao lado
 * dele em Aparência. Grava em cookie (o layout lê no servidor) e pede um
 * refresh para o `AppShell` já atual receber o modo novo.
 */
export function SidebarModeToggle() {
  const router = useRouter()
  const [modo, setModo] = useModoDaSidebar()

  function escolher(next: SidebarMode) {
    setModo(next)
    router.refresh()
  }

  return (
    <div role="group" aria-label="Menu lateral" className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm">
      {OPTIONS.map(({ value, icon: Icon, label, hint }) => (
        <button
          key={value}
          type="button"
          aria-pressed={modo === value}
          title={hint}
          onClick={() => escolher(value)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
            modo === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
