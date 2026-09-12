import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/business/founder', label: 'Founder' },
  { href: '/business/direction', label: 'Direção' },
  { href: '/business/validation', label: 'Validação' },
  { href: '/business/caixa', label: 'Caixa' },
]

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* TODO: substituir por componente do design system (SidebarItem) quando disponível em frontend/components/ui */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Módulo Negócio</h2>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
