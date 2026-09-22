'use client'

import { useState } from 'react'
import { ArrowLeftRight, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CategoryPicker, type PickerCategory } from '../../_components/CategoryPicker'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Barra de ações em lote — aparece só quando há seleção.
 *
 * Oferece poucas operações de propósito: as que fazem sentido aplicar
 * igualmente a um conjunto escolhido a dedo. Editar valor ou data em lote
 * não entra, porque lançamentos diferentes com o mesmo valor é coincidência,
 * não intenção.
 *
 * Nenhuma ação daqui mexe em série: seleção não é série. Quem quer atingir
 * as ocorrências futuras usa o menu da linha, que pergunta o escopo.
 */
export function BulkActionsBar({
  ids,
  categories,
  onClear,
  onDone,
}: {
  ids: string[]
  categories: PickerCategory[]
  onClear: () => void
  onDone: () => void
}) {
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  if (ids.length === 0) return null

  async function enviar(body: Record<string, unknown>) {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids.map(Number), ...body }),
      })
      onDone()
      onClear()
      setCategoryId('')
      setConfirmando(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2 shadow-lg">
      <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
        {ids.length} {ids.length === 1 ? 'selecionada' : 'selecionadas'}
        <button onClick={onClear} aria-label="Limpar seleção" className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </span>

      {/* Categorizar em lote é o caso de uso principal: sai da importação com
          um monte de "Sem categoria" e resolve tudo de uma vez. */}
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={(v) => {
          setCategoryId(v)
          if (v) enviar({ action: 'update', changes: { category_id: Number(v) } })
        }}
        placeholder="Definir categoria..."
        className="w-[15rem]"
      />

      <Button
        variant="outline"
        size="sm"
        disabled={saving}
        onClick={() => enviar({ action: 'update', changes: { is_internal_transfer: true } })}
      >
        <ArrowLeftRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Marcar como interna
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {confirmando ? (
          <>
            <span className="text-sm text-muted-foreground">Excluir {ids.length}?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => enviar({ action: 'delete' })} disabled={saving}>
              Confirmar
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmando(true)}
            disabled={saving}
            aria-label="Excluir selecionadas"
          >
            <Trash2 className="size-4 text-destructive" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default BulkActionsBar
