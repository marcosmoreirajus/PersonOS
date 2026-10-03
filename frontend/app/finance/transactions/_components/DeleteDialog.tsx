'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export type Scope = 'only_this' | 'this_and_future' | 'all'

const OPCOES: { value: Scope; label: string; hint: string }[] = [
  { value: 'only_this', label: 'Somente este', hint: 'Os outros lançamentos da série continuam.' },
  {
    value: 'this_and_future',
    label: 'Este e os futuros',
    hint: 'Encerra a série a partir desta data — ela não volta a ser gerada.',
  },
  { value: 'all', label: 'Toda a série', hint: 'Remove a série inteira.' },
]

/**
 * Exclusão com escopo.
 *
 * A mesma tríade vale para editar, excluir e pular — regra aprendida uma vez,
 * três lugares. Lançamento sem série não tem o que escolher, então o diálogo
 * some com as opções em vez de mostrar uma escolha falsa.
 *
 * Já efetivado nunca é removido pelos escopos amplos (regra aplicada no
 * backend): apagar uma parcela paga não cancela o gasto, só faz o app
 * discordar do extrato.
 */
export function DeleteDialog({
  transaction,
  onOpenChange,
  onDeleted,
}: {
  transaction: { id: number; description: string | null; series_id: number | null } | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [scope, setScope] = useState<Scope>('only_this')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const temSerie = Boolean(transaction?.series_id)

  async function confirmar() {
    if (!transaction) return
    setSaving(true)
    setErro(null)
    try {
      await api(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
        query: { scope: temSerie ? scope : 'only_this' },
      })
      onDeleted()
      onOpenChange(false)
      setScope('only_this')
    } catch (e) {
      // Não fechar o diálogo: sem isto, uma exclusão que falhou deixava a tela
      // mostrando o lançamento como se tivesse sumido.
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(transaction)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir lançamento</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {transaction?.description ?? 'Este lançamento'} será removido.{' '}
          {/* Sem lápide: reimportar o mesmo extrato traz o registro de volta —
              escolha consciente de previsibilidade sobre proteção. */}
          Se ele voltar num extrato importado depois, será tratado como novo.
        </p>

        {temSerie && (
          <div className="flex flex-col gap-2">
            {OPCOES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setScope(o.value)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-colors',
                  scope === o.value ? 'border-foreground bg-muted' : 'border-border hover:bg-accent'
                )}
              >
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </button>
            ))}
          </div>
        )}

        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={saving}>
            {saving ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteDialog
