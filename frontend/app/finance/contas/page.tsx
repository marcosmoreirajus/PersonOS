'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { TiltCard } from '@/components/motion/tilt-card'
import { Button } from '@/components/ui/button'
import { SkeletonLinhas } from '@/components/ui/carregando'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID } from '@/lib/api'
import { NovaContaDialog, type Conta } from '../importar/_components/NovaContaDialog'
import { SecaoCartoes } from '../cartoes/_components/SecaoCartoes'
import { TileConta } from '../_components/TileConta'
import { useContas } from '../_components/useContas'

/**
 * Contas e cartões: a visão completa do que o quadro da Visão Geral só
 * resume. Contas com saldo (cadastrar, editar, marcar como fora do Saldo
 * Geral) e, abaixo, os cartões com as faturas. O Saldo Geral aparece uma vez,
 * aqui no resumo; as contas marcadas como fora dele seguem listadas, com o
 * próprio saldo, e entram numa linha à parte.
 */
export default function ContasECartoesPage() {
  const { saldos, contas, erro, recarregar } = useContas()
  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState<Conta | null>(null)

  const foraDoTotal = saldos
    ? Math.round(saldos.accounts.filter((c) => c.exclude_from_total).reduce((s, c) => s + c.balance, 0) * 100) / 100
    : 0
  const temFora = saldos?.accounts.some((c) => c.exclude_from_total) ?? false

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-foreground">Contas e cartões</h1>

      <section className="flex flex-col gap-4" aria-labelledby="titulo-contas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-contas" className="text-lg font-semibold text-foreground">
            Contas
          </h2>
          {!erro && saldos !== null && (
            <Button variant="outline" onClick={() => setNovaAberta(true)}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Nova conta
            </Button>
          )}
        </div>

        {erro ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </div>
        ) : saldos === null ? (
          <SkeletonLinhas linhas={2} />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Saldo Geral</span>
                <MoneyValue value={saldos.total} className="text-xl font-bold" />
              </div>
              {temFora && (
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Fora do Saldo Geral</span>
                  <MoneyValue value={foraDoTotal} className="text-xl font-bold" />
                </div>
              )}
            </div>

            {saldos.accounts.length === 0 && !saldos.no_account ? (
              <p className="text-sm text-muted-foreground">Cadastre suas contas para ver os saldos.</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
                {saldos.accounts.map((c) => (
                  <li key={c.account_id}>
                    <TileConta
                      linha={c}
                      completa={contas.find((x) => x.id === c.account_id)}
                      onEditar={setEditando}
                      className="h-full"
                    />
                  </li>
                ))}
                {saldos.no_account && (
                  <li>
                    <TiltCard className="h-full border border-dashed border-border">
                      <div className="flex flex-col gap-4 p-4">
                        <span className="text-sm text-muted-foreground">Sem conta</span>
                        <MoneyValue value={saldos.no_account.balance} className="text-xl font-bold" />
                      </div>
                    </TiltCard>
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </section>

      <SecaoCartoes />

      <NovaContaDialog open={novaAberta} onOpenChange={setNovaAberta} userId={CURRENT_USER_ID} onCreated={recarregar} />
      {editando && (
        <NovaContaDialog
          key={editando.id}
          open
          onOpenChange={(aberto) => !aberto && setEditando(null)}
          userId={CURRENT_USER_ID}
          conta={editando}
          onCreated={recarregar}
        />
      )}
    </div>
  )
}
