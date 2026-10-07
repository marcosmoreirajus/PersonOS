'use client'

import { useCallback, useEffect, useState } from 'react'

import { CURRENT_USER_ID, api } from '@/lib/api'
import { TIPOS_CONTA, type Conta } from '../importar/_components/NovaContaDialog'

/** O que `accounts_balance` (GET /api/dashboard) devolve; a conta é do backend. */
export type Saldos = {
  accounts: { account_id: number; name: string; kind: string; balance: number; exclude_from_total?: boolean }[]
  no_account: { balance: number } | null
  total: number
}

export const rotuloTipo = (kind: string) => TIPOS_CONTA.find((t) => t.value === kind)?.label ?? kind

/**
 * Contas com saldo: os saldos vêm do resumo da Visão Geral (a conta é do
 * backend) e a conta completa — saldo inicial, ícone, marca de "fora do Saldo
 * Geral" — vem da lista de contas, que é o que o diálogo de edição precisa.
 * `recarregar` busca de novo depois de criar ou editar.
 */
export function useContas() {
  const [saldos, setSaldos] = useState<Saldos | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

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

  const recarregar = useCallback(() => setRecarga((n) => n + 1), [])
  return { saldos, contas, erro, recarregar }
}
