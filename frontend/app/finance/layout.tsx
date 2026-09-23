import Link from 'next/link'

import { AppShell, AppSidebarTrigger } from '@/components/ui/app-shell'
import { EyeToggle } from '@/components/ui/eye-toggle'
import { ValuesVisibilityProvider } from '@/components/ui/money-value'
import FinanceTabs from './_components/FinanceTabs'

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ValuesVisibilityProvider>
      <AppShell>
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
          <AppSidebarTrigger />
          <FinanceTabs />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/finance/transactions"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              + Nova transação
            </Link>
            <EyeToggle />
          </div>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </AppShell>
    </ValuesVisibilityProvider>
  )
}
