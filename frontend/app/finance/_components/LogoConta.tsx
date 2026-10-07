import { logoDaConta } from '@/lib/conta-logos'
import { cn } from '@/lib/utils'

/**
 * Selo redondo de uma conta: o item da coleção de logos (sigla sobre a cor da
 * instituição, ou ícone sobre a cor escolhida). Sem logo válido, não renderiza
 * nada.
 */
export function LogoConta({ logo, className }: { logo: string | null | undefined; className?: string }) {
  const item = logoDaConta(logo)
  if (!item) return null
  const Icone = item.icone
  return (
    <span
      aria-hidden="true"
      title={item.nome}
      className={cn(
        'flex size-9 shrink-0 select-none items-center justify-center rounded-full text-xs font-bold leading-none',
        className
      )}
      style={{ backgroundColor: item.fundo, color: item.texto }}
    >
      {Icone ? <Icone className="size-[45%]" strokeWidth={1.75} /> : item.sigla}
    </span>
  )
}
