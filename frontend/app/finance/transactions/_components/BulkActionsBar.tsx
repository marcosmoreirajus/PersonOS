'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, Save, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { CategoryPicker, categoriasDoTipo, type PickerCategory } from '../../_components/CategoryPicker'

type Pendente = {
  category_id?: number
  is_internal_transfer?: boolean
}

/**
 * Barra de ações em lote — aparece só quando há seleção.
 *
 * As mudanças são **acumuladas e revisadas antes de gravar**: escolher uma
 * categoria não aplica nada sozinho. Numa operação que atinge N registros de
 * uma vez, aplicar no clique de um seletor é fácil demais de fazer sem
 * querer, e não existe desfazer. A linha "Vai mudar" mostra exatamente o que
 * será gravado, com remoção individual antes de confirmar.
 *
 * Nenhuma ação daqui mexe em série: seleção não é série. Quem quer atingir as
 * ocorrências futuras usa o menu da linha, que pergunta o escopo.
 */
export function BulkActionsBar({
  ids,
  tipos,
  categories,
  onClear,
  onDone,
}: {
  ids: string[]
  /** Tipos presentes na seleção — decide quais categorias podem ser aplicadas. */
  tipos: ('income' | 'expense')[]
  categories: PickerCategory[]
  onClear: () => void
  onDone: () => void
}) {
  const [pendente, setPendente] = useState<Pendente>({})
  const [saving, setSaving] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Seleção de um tipo só oferece as categorias dele; seleção mista oferece
  // apenas as que servem aos dois lados, senão o lote gravaria "Salário" numa
  // despesa que estava junto por acaso.
  const disponiveis = useMemo(() => {
    const unicos = [...new Set(tipos)]
    if (unicos.length === 1) return categoriasDoTipo(categories, unicos[0])
    return categories.filter((c) => c.type === 'both')
  }, [categories, tipos])

  const mudancas = useMemo(() => {
    const lista: { key: keyof Pendente; label: string }[] = []
    if (pendente.category_id != null) {
      const nome = categories.find((c) => c.id === pendente.category_id)?.name ?? ''
      lista.push({ key: 'category_id', label: `Categoria: ${nome}` })
    }
    if (pendente.is_internal_transfer != null) {
      lista.push({
        key: 'is_internal_transfer',
        label: `Transferência interna: ${pendente.is_internal_transfer ? 'Marcar' : 'Desmarcar'}`,
      })
    }
    return lista
  }, [pendente, categories])

  if (ids.length === 0) return null

  function limparMudanca(key: keyof Pendente) {
    setPendente((atual) => {
      const novo = { ...atual }
      delete novo[key]
      return novo
    })
  }

  async function enviar(body: Record<string, unknown>) {
    setSaving(true)
    setErro(null)
    try {
      await api('/api/transactions/bulk', {
        method: 'POST',
        body: { ids: ids.map(Number), ...body },
      })
      onDone()
      onClear()
      setPendente({})
      setConfirmando(false)
    } catch (e) {
      // Não limpar a seleção: some com o que a pessoa escolheu resolver.
      setErro(e instanceof Error ? e.message : 'Não foi possível aplicar a mudança.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sticky bottom-4 z-30 flex flex-col gap-2 rounded-xl border border-border bg-background p-2 shadow-lg">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
        <span className="flex shrink-0 items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
          {ids.length} {ids.length === 1 ? 'selecionada' : 'selecionadas'}
          <button onClick={onClear} aria-label="Limpar seleção" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </span>

        {/* Categorizar em lote é o caso de uso principal: sai da importação
            com um monte de "Sem categoria" e resolve tudo de uma vez.

            O seletor **não guarda** o valor escolhido: ele volta ao
            placeholder e quem declara a mudança é o chip em "Vai mudar".
            Guardar o valor aqui sugeriria que aquela é a categoria atual do
            conjunto — e as transações selecionadas podem ter categorias
            diferentes entre si. Este campo é o instrumento de escolher, não
            o estado da seleção. */}
        <CategoryPicker
          categories={disponiveis}
          value=""
          onChange={(v) => v && setPendente((a) => ({ ...a, category_id: Number(v) }))}
          placeholder="Definir categoria..."
          className="w-56 shrink-0"
        />

        {/* Marcar e desmarcar precisam ser escolhas distintas: com um botão só,
            "Marcar como interna" não teria como desfazer em lote. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="shrink-0">
                <ArrowLeftRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Transferência interna
                <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setPendente((a) => ({ ...a, is_internal_transfer: true }))}>
              Marcar como interna
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPendente((a) => ({ ...a, is_internal_transfer: false }))}>
              Desmarcar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex shrink-0 items-center gap-2">
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
            <>
              <Button
                size="sm"
                disabled={saving || mudancas.length === 0}
                onClick={() => enviar({ action: 'update', changes: pendente })}
              >
                <Save className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Salvar ({ids.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmando(true)}
                disabled={saving}
                aria-label="Excluir selecionadas"
              >
                <Trash2 className="size-4 text-destructive" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      {erro && (
        <p className="px-1 text-xs text-destructive" role="alert">
          {erro}
        </p>
      )}

      {mudancas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vai mudar</span>
          {mudancas.map((m) => (
            <button
              key={m.key}
              onClick={() => limparMudanca(m.key)}
              className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent"
            >
              {m.label}
              <X className="size-3" strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default BulkActionsBar
