import FinanceNav from './_components/FinanceNav'

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <h2 className="mb-6 px-3 text-lg font-semibold text-foreground">
          Módulo Finanças
        </h2>
        <FinanceNav />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
