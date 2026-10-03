'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { criarPreferenciaDoNavegador } from '@/lib/hooks/use-preferencia-do-navegador'

const STORAGE_KEY = 'personos-values-hidden'

interface ValuesVisibilityState {
  hidden: boolean
  toggle: () => void
}

// Oculto por padrão — inclusive no render do servidor, que não lê o localStorage.
const useValoresOcultos = criarPreferenciaDoNavegador<boolean>({
  ler: () => {
    const salvo = localStorage.getItem(STORAGE_KEY)
    return salvo === null ? true : salvo === 'true'
  },
  gravar: (oculto) => localStorage.setItem(STORAGE_KEY, String(oculto)),
  servidor: true,
})

const ValuesVisibilityContext = createContext<ValuesVisibilityState | null>(null)

/**
 * Provedor único de privacidade pro módulo Finanças inteiro — decisão de
 * 15/09: o olho cobre "praticamente todo valor monetário visível" no
 * módulo, não só uma tela. Fica no `finance/layout.tsx`, persistente entre
 * abas. Oculto por padrão.
 */
function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useValoresOcultos()

  function toggle() {
    setHidden(!hidden)
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
