import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface BadgeProps extends React.ComponentProps<'span'> {
  /** Cor crua (hex, oklch, var(--x)...) — ex.: `categories.json`'s `color`. */
  color?: string
  icon?: LucideIcon
}

/**
 * Pill de categoria/tipo, tintado a 10% na cor recebida via `color-mix` —
 * nunca cor sólida. Não usar pra status (situação de algo) — status é um
 * eixo semântico diferente e deve ficar num elemento visual separado.
 */
function Badge({ color = 'var(--foreground)', icon: Icon, className, style, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      style={{ '--badge-color': color, ...style } as React.CSSProperties}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        'bg-[color-mix(in_srgb,var(--badge-color)_10%,transparent)] text-[var(--badge-color)]',
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export { Badge }
