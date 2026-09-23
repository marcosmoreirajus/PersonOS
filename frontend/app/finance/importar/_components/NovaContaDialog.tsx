'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/motion/input'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Conta = { id: number; name: string; kind: 'checking' | 'card' | 'wallet' }

export const TIPOS_CONTA: { value: Conta['kind']; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'card', label: 'Cartão de crédito' },
  { value: 'wallet', label: 'Carteira' },
]

/** Cria uma conta sem sair do fluxo de importação. */
export function NovaContaDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  onCreated: (c: Conta) => void
}) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<Conta['kind']>('checking')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`${API_URL}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: nome, kind: tipo }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : 'Não foi possível criar a conta.')
      onCreated(json.data)
      setNome('')
      setTipo('checking')
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input id="conta-nome" label="Nome (ex.: Bradesco, C6, BTG)" value={nome} onChange={setNome} error={erro ?? undefined} reserveErrorLine />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de conta">
            {TIPOS_CONTA.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tipo === t.value}
                onClick={() => setTipo(t.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  tipo === t.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>
            {salvando ? 'Criando...' : 'Criar conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
