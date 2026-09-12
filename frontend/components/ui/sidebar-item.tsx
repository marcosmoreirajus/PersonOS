import * as React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SidebarItemProps
  extends Omit<React.ComponentProps<'button'>, 'onClick'> {
  /** Ícone lucide-react (ou qualquer componente compatível). */
  icon?: LucideIcon
  /** Texto do item. */
  label: string
  /** Se presente, o item vira um link (next/link). */
  href?: string
  /** Marca o item como a rota/aba atualmente ativa. */
  active?: boolean
  onClick?: () => void
}

/**
 * Item de navegação de sidebar.
 *
 * O hover é aplicado no elemento inteiro (bg-accent), não só na cor do
 * texto — passe o mouse em qualquer ponto do item, não só em cima do texto,
 * pra ver o background aparecer. O estado ativo usa bg-secondary + texto em
 * peso maior, permanentemente (sem precisar de hover).
 */
function SidebarItem({
  icon: Icon,
  label,
  href,
  active = false,
  onClick,
  className,
  ...props
}: SidebarItemProps) {
  const classes = cn(
    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-secondary font-medium text-secondary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    className
  )

  const content = (
    <>
      {Icon ? (
        <Icon
          className={cn(
            'size-4 shrink-0',
            active ? 'text-secondary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
          )}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{label}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      aria-current={active ? 'page' : undefined}
      {...props}
    >
      {content}
    </button>
  )
}

export { SidebarItem }
