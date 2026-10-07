import { Loader, type LoaderVariant } from '@/components/ui/loader'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Padrão de "carregando" do app: spinner + texto. Tela inteira por padrão
 * (centralizado, ocupa parte da altura); `compacto` para dentro de um card ou
 * seção, onde a altura não pode saltar. `variante="bars"` é a dos quadros de
 * gráfico (as barras lembram o que vai aparecer ali).
 */
export function Carregando({
  rotulo = 'Carregando',
  compacto = false,
  variante = 'spinner',
  className,
}: {
  rotulo?: string
  compacto?: boolean
  variante?: LoaderVariant
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 text-muted-foreground',
        compacto ? 'py-4' : 'min-h-[40vh]',
        className
      )}
    >
      <Loader variant={variante} size={compacto && variante === 'spinner' ? 18 : 28} label={rotulo} />
      <span className="text-sm" aria-hidden="true">
        {rotulo}...
      </span>
    </div>
  )
}

/**
 * Esqueleto de lista (ícone + duas linhas + valor) para quadros de lista que
 * carregam sozinhos: a altura já é a da lista pronta, então nada salta.
 */
export function SkeletonLinhas({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
