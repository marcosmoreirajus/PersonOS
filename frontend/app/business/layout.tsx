import { AppShell, AppSidebarTrigger } from '@/components/ui/app-shell'
import { sidebarDoCookie } from '@/lib/sidebar-server'
import BusinessTabs from './_components/BusinessTabs'

/**
 * Este layout mantinha uma sidebar própria com classes cruas (`gray-*`) e um
 * TODO pedindo o componente do design system. As duas coisas saem juntas: a
 * navegação estrutural agora é a da casca, e as seções viraram tabs com os
 * tokens do tema.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const sidebar = await sidebarDoCookie()
  return (
    <AppShell {...sidebar}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <AppSidebarTrigger />
        <BusinessTabs />
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </AppShell>
  )
}
