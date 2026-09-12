import Link from 'next/link'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-foreground">PersonOS</h1>
        <p className="mt-2 text-muted-foreground">Sistema integrado de gestão pessoal</p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/finance">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Finanças</CardTitle>
              <CardDescription>Dashboard, transações e categorias</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/business/founder">
          <Card className="cursor-pointer transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Negócio</CardTitle>
              <CardDescription>Founder, Direção, Validação e Caixa</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  )
}
