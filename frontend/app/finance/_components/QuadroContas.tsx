'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { NovaContaDialog, TIPOS_CONTA, type Conta } from '../importar/_components/NovaContaDialog'

/** O que `accounts_balance` (GET /api/dashboard) devolve; a conta é do backend. */
type Saldos = {
  accounts: { account_id: number; name: string; kind: string; balance: number }[]
  no_account: { balance: number } | null
  total: number
}

const rotuloTipo = (kind: string) => TIPOS_CONTA.find((t) => t.value === kind)?.label ?? kind

/**
 * Quadro "Contas e cartões" da Visão Geral (por ora só contas): saldo de cada
 * conta, "Sem conta" quando houver e o total. Cadastra e edita pelo mesmo
 * diálogo da importação. Não filtra nada na página; carrega e falha sozinho.
 * `onChange` avisa a página quando um saldo mudou, para o card Saldo acompanhar.
 */
export function QuadroContas({ onChange }: { onChange?: () => void }) {
  const [saldos, setSaldos] = useState<Saldos | null>(null)
  // Saldo vem do resumo; saldo inicial e logo (para editar) vêm da lista de contas.
  const [contas, setContas] = useState<Conta[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState<Conta | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<{ accounts_balance: Saldos }>(`/api/dashboard/${CURRENT_USER_ID}`),
      api<Conta[]>(`/api/accounts/user/${CURRENT_USER_ID}`),
    ])
      .then(([resumo, lista]) => {
        if (cancelled) return
        setSaldos(resumo.accounts_balance)
        setContas(lista)
        setErro(null)
      })
      .catch((e) => {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as contas.')
      })
    return () => {
      cancelled = true
    }
  }, [recarga])

  const salvou = useCallback(() => {
    setRecarga((n) => n + 1)
    onChange?.()
  }, [onChange])

  const vazio = saldos !== null && saldos.accounts.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Contas e cartões</CardTitle>
            <CardDescription>O saldo de cada conta, somando o que já foi efetivado.</CardDescription>
          </div>
          {!erro && saldos !== null && !vazio && (
            <Button variant="outline" size="sm" onClick={() => setNovaAberta(true)}>
              <Plus className="size-4" />
              Conta
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {erro ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </div>
        ) : saldos === null ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : vazio ? (
          // Sem contas, tudo estaria em "Sem conta": o convite basta.
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Cadastre suas contas para ver os saldos</p>
            <Button variant="outline" size="sm" onClick={() => setNovaAberta(true)}>
              <Plus className="size-4" />
              Conta
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {saldos.accounts.map((c) => {
              const completa = contas.find((x) => x.id === c.account_id)
              return (
                <li key={c.account_id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                  {completa?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={completa.logo} alt="" className="size-8 shrink-0 rounded-md object-contain" />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{rotuloTipo(c.kind)}</span>
                  </div>
                  <MoneyValue value={c.balance} className="shrink-0 text-sm font-medium" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${c.name}`}
                    disabled={!completa}
                    onClick={() => completa && setEditando(completa)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </li>
              )
            })}
            {saldos.no_account && (
              <li className="flex items-center gap-3 border-b border-border py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Sem conta</span>
                <MoneyValue value={saldos.no_account.balance} className="shrink-0 text-sm font-medium" />
              </li>
            )}
            <li className="flex items-center justify-between pt-3 text-sm">
              <span className="font-medium text-foreground">Total nas contas</span>
              <MoneyValue value={saldos.total} className="font-semibold" />
            </li>
          </ul>
        )}
      </CardContent>

      <NovaContaDialog open={novaAberta} onOpenChange={setNovaAberta} userId={CURRENT_USER_ID} onCreated={salvou} />
      {editando && (
        <NovaContaDialog
          key={editando.id}
          open
          onOpenChange={(aberto) => !aberto && setEditando(null)}
          userId={CURRENT_USER_ID}
          conta={editando}
          onCreated={salvou}
        />
      )}
    </Card>
  )
}
