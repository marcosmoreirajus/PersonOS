'use client'

import { Eye, EyeOff } from 'lucide-react'

import { useValuesHidden } from './money-value'

/** Botão de privacidade — persistente no shell do módulo Finanças. */
function EyeToggle() {
  const { hidden, toggle } = useValuesHidden()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Exibir valores' : 'Ocultar valores'}
      title={hidden ? 'Exibir valores' : 'Ocultar valores'}
      className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
    >
      {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  )
}

export { EyeToggle }
