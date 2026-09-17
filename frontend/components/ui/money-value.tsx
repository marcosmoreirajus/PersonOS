'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'personos-values-hidden'

interface ValuesVisibilityState {
  hidden: boolean
  toggle: () => void
}

const ValuesVisibilityContext = createContext<ValuesVisibilityState | null>(null)

/**
 * Provedor único de privacidade pro módulo Finanças inteiro — decisão de
 * 15/09: o olho cobre "praticamente todo valor monetário visível" no
 * módulo, não só uma tela. Fica no `finance/layout.tsx`, persistente entre
 * abas. Oculto por padrão.
 */
function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setHidden(saved === 'true')
    } catch {
      // localStorage indisponível — mantém o default oculto.
    }
  }, [])

  function toggle() {
    setHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignora — a preferência só não persiste entre sessões.
      }
      return next
    })
  }

  return <ValuesVisibilityContext.Provider value={{ hidden, toggle }}>{children}</ValuesVisibilityContext.Provider>
}

function useValuesHidden() {
  const ctx = useContext(ValuesVisibilityContext)
  if (!ctx) {
    throw new Error('useValuesHidden precisa estar dentro de <ValuesVisibilityProvider> (finance/layout.tsx)')
  }
  return ctx
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export interface MoneyValueProps {
  value: number
  className?: string
}

/** Formata um valor em R$, mascarando com •••• quando a privacidade está ativa. */
function MoneyValue({ value, className }: MoneyValueProps) {
  const { hidden } = useValuesHidden()
  const formatted = formatCurrency(value)
  return <span className={className}>{hidden ? formatted.replace(/[0-9]/g, '•') : formatted}</span>
}

export { ValuesVisibilityProvider, useValuesHidden, MoneyValue, formatCurrency }
