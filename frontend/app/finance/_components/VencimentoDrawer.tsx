'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Pencil, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MoneyValue } from '@/components/ui/money-value'
import { api } from '@/lib/api'
import { formatDateBR, hojeLocal } from '@/lib/dates'
import { hrefLancamento } from '@/lib/relatorios-gastos'

export type Vencimento = {
  id: number
  description: string | null
  amount: number
  /** AAAA-MM-DD */
  due_date: string
  overdue: boolean
}

export type VencimentoAberto = { v: Vencimento; tipo: 'pagar' | 'receber' }

/**
 * Drawer de um vencimento: os dados e as operações (efetivar, editar, excluir).
 * Efetiva na data de hoje, não na de vencimento — o dinheiro se moveu agora, e
 * é isso que `settled_at` registra (mesma regra do alerta de atrasados em
 * Transações). Editar abre o lançamento em Transações. `onChanged` avisa a
 * página para recarregar o que mudou.
 */
export function VencimentoDrawer(props: { item: VencimentoAberto | null; onClose: () => void; onChanged: () => void }) {
  // key: o erro e a confirmação de exclusão zeram ao trocar de item.
  return <Conteudo key={props.item?.v.id ?? 'fechado'} {...props} />
}

function Conteudo({
  item,
  onClose,
  onChanged,
}: {
  item: VencimentoAberto | null
  onClose: () => void
  onChanged: () => void
}) {
  const [operacao, setOperacao] = useState<'efetivar' | 'excluir' | null>(null)
  const salvando = operacao !== null
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExclusao, setConfirmaExclusao] = useState(false)

  useEffect(() => {
    if (!item) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [item, onClose])

  if (!item) return null
  const { v, tipo } = item
  const rotuloEfetivar = tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'

  async function executar(qual: 'efetivar' | 'excluir', fazer: () => Promise<unknown>, falha: string) {
    setOperacao(qual)
    setErro(null)
    try {
      await fazer()
      onChanged()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : falha)
      setOperacao(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        className="relative flex h-full w-full max-w-sm flex-col gap-5 bg-background p-6 shadow-xl"
        role="dialog"
        aria-label="Vencimento"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {tipo === 'pagar' ? 'A pagar' : 'A receber'}
            </p>
            <h2 className="text-lg font-semibold text-foreground">{v.description || 'Sem descrição'}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <MoneyValue value={v.amount} className="text-3xl font-bold" />

        <dl className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Vencimento</dt>
            <dd>{formatDateBR(v.due_date)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Situação</dt>
            <dd className={v.overdue ? 'font-medium text-destructive' : ''}>{v.overdue ? 'Atrasado' : 'Em aberto'}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2">
          {erro && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {erro}
            </p>
          )}
          <Button
            disabled={salvando}
            pending={operacao === 'efetivar'}
            onClick={() =>
              executar(
                'efetivar',
                () =>
                  api(`/api/transactions/${v.id}`, {
                    method: 'PATCH',
                    body: { settled_at: hojeLocal(), scope: 'only_this' },
                  }),
                'Não foi possível confirmar.'
              )
            }
          >
            <Check className="size-4" />
            {rotuloEfetivar}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" render={<Link href={hrefLancamento(v.id)} />} nativeButton={false}>
              <Pencil className="size-4" />
              Editar
            </Button>
            {confirmaExclusao ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={salvando}
                pending={operacao === 'excluir'}
                onClick={() =>
                  executar(
                    'excluir',
                    () => api(`/api/transactions/${v.id}`, { method: 'DELETE', query: { scope: 'only_this' } }),
                    'Não foi possível excluir.'
                  )
                }
              >
                <Trash2 className="size-4" />
                Confirmar
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={salvando} onClick={() => setConfirmaExclusao(true)}>
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )}
          </div>
          {confirmaExclusao && (
            <p className="text-xs text-muted-foreground">Exclui só este lançamento. Clique em Confirmar para seguir.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
