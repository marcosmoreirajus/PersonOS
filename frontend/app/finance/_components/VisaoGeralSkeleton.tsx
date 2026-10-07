import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Carregando, SkeletonLinhas } from '@/components/ui/carregando'
import { Skeleton } from '@/components/ui/skeleton'

/** Esqueleto da Visão Geral: mesma grade da página pronta; os quadros de gráfico mostram o loader de barras. */
export function VisaoGeralSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Visão geral</h1>
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Skeleton className="h-44 rounded-2xl" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 rounded-xl" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <SkeletonLinhas />
          <SkeletonLinhas />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {['Saldo por dia', 'Onde o dinheiro saiu'].map((titulo) => (
          <Card key={titulo}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Carregando compacto variante="bars" rotulo="Carregando gráfico" className="min-h-52" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <SkeletonLinhas linhas={4} />
        </CardContent>
      </Card>
    </div>
  )
}
