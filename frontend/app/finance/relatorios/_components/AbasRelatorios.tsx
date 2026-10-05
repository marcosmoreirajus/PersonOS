'use client'

import { cn } from '@/lib/utils'
import { ABAS, type Aba } from '@/lib/relatorios-parcelados'

/** As abas de Relatórios (Resumo | Parcelados). A escolhida vai na URL (`aba`). */
export function AbasRelatorios({ aba, onChange }: { aba: Aba; onChange: (aba: Aba) => void }) {
  return (
    <div role="tablist" aria-label="Relatórios" className="flex gap-2">
      {ABAS.map(({ valor, rotulo }) => {
        const ativa = aba === valor
        return (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(valor)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              ativa
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-muted text-secondary-foreground hover:bg-accent'
            )}
          >
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}
