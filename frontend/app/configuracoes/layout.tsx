import { AppShell, AppSidebarTrigger } from '@/components/ui/app-shell'

/**
 * Configurações é global, não de um módulo: mora fora de `/finance` e não
 * tem tabs de seção. Nasce só com Avisos (issue #2), sem placeholders de
 * seções futuras.
 */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <AppSidebarTrigger />
        <span className="text-sm font-medium text-foreground">Configurações</span>
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </AppShell>
  )
}
