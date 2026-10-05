'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ATALHOS, type Atalho, type PeriodoEscolhido } from '@/lib/relatorios-periodo'

export interface PeriodSelectorProps {
  periodo: PeriodoEscolhido
  onChange: (periodo: PeriodoEscolhido) => void
  /** Datas do rascunho do personalizado, ainda sem os dois lados preenchidos. */
  rascunho: { de: string; ate: string }
  onRascunho: (rascunho: { de: string; ate: string }) => void
}

/**
 * Seletor de período da tela: atalhos em fila e, no personalizado, as duas
 * datas. A indicação do critério ("por data do lançamento") fica junto, porque
 * é ela que diz o que cada número conta.
 */
export function PeriodSelector({ periodo, onChange, rascunho, onRascunho }: PeriodSelectorProps) {
  function escolher(atalho: Atalho) {
    if (atalho !== 'personalizado') return onChange({ atalho, de: null, ate: null })
    // Só vira personalizado de verdade quando as duas datas existem; antes
    // disso a tela mostra os campos e continua no período anterior.
    if (rascunho.de && rascunho.ate && rascunho.de <= rascunho.ate) {
      onChange({ atalho, de: rascunho.de, ate: rascunho.ate })
    } else {
      onRascunho({ ...rascunho })
      onChange({ atalho, de: null, ate: null })
    }
  }

  function mudaData(campo: 'de' | 'ate', valor: string) {
    const novo = { ...rascunho, [campo]: valor }
    onRascunho(novo)
    if (novo.de && novo.ate && novo.de <= novo.ate) onChange({ atalho: 'personalizado', de: novo.de, ate: novo.ate })
  }

  const emEdicao = periodo.atalho === 'personalizado'
  const invertido = Boolean(rascunho.de && rascunho.ate && rascunho.de > rascunho.ate)

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Período" className="flex flex-wrap items-center gap-2">
        {ATALHOS.map(({ valor, rotulo }) => {
          const ativo = periodo.atalho === valor
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => escolher(valor)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                ativo
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-muted text-secondary-foreground hover:bg-accent'
              )}
            >
              {rotulo}
            </button>
          )
        })}
      </div>

      {emEdicao && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            De
            <Input
              type="date"
              value={rascunho.de}
              onChange={(e) => mudaData('de', e.target.value)}
              aria-label="Data inicial"
              aria-invalid={invertido || undefined}
              className="w-40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Até
            <Input
              type="date"
              value={rascunho.ate}
              onChange={(e) => mudaData('ate', e.target.value)}
              aria-label="Data final"
              aria-invalid={invertido || undefined}
              className="w-40"
            />
          </label>
          {invertido && <span className="text-sm text-destructive">A data inicial é depois da final.</span>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Contado por data do lançamento. Só o que já foi efetivado.</p>
    </div>
  )
}
