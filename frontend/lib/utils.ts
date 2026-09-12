import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge condicional de classes Tailwind (padrão shadcn/ui).
 * clsx resolve as condicionais, tailwind-merge remove conflitos
 * (ex.: cn('px-2', 'px-4') -> 'px-4').
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
