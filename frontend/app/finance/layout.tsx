import Link from 'next/link'

import FinanceNav from './_components/FinanceNav'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { EyeToggle } from '@/components/ui/eye-toggle'
import { ValuesVisibilityProvider } from '@/components/ui/money-value'

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ValuesVisibilityProvider>
      <div className="flex min-h-screen bg-canvas">
        <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border p-4">
          <div>
            <h2 className="mb-6 px-3 text-lg font-semibold text-foreground">
              Módulo Finanças
            </h2>
            <FinanceNav />
          </div>
          <div className="px-3">
            <ThemeToggle />
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-end gap-2 border-b border-border px-8 py-4">
            <Link
              href="/finance/transactions"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              + Nova transação
            </Link>
            <EyeToggle />
          </header>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </ValuesVisibilityProvider>
  )
}
