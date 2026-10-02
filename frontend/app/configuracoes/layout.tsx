import { AppShell, AppSidebarTrigger } from '@/components/ui/app-shell'
import { sidebarAbertaNoCookie } from '@/lib/sidebar-server'

/**
 * Configurações é global, não de um módulo: mora fora de `/finance` e não
 * tem tabs de seção. Seções: Avisos (issue #2) e Aparência — sem
 * placeholders de seções futuras.
 */
export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = await sidebarAbertaNoCookie()
  return (
    <AppShell sidebarOpen={sidebarOpen}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <AppSidebarTrigger />
        <span className="text-sm font-medium text-foreground">Configurações</span>
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </AppShell>
  )
}
