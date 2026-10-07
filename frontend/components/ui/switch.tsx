'use client'

import { cn } from '@/lib/utils'

/** Interruptor simples (role=switch): liga/desliga uma opção do formulário. */
export function Switch({
  checked,
  onCheckedChange,
  id,
  className,
  ...props
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
} & Omit<React.ComponentProps<'button'>, 'onChange' | 'role' | 'type'>) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        checked ? 'bg-foreground' : 'bg-muted-foreground/30',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[1.25rem]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
