'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/motion/input'
import { CURRENT_USER_ID, api } from '@/lib/api'

export type Cartao = {
  id: number
  name: string
  limit: number
  closing_day: number
  due_day: number
  default_payer_account_id: number | null
}

export type ContaPagadora = { id: number; name: string }

/** "5.000,50" ou "5000.5" para número; `null` se não for um número. */
function lerValor(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return 0
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Cria ou edita um Cartão (`cartao` preenchido = edição). */
export function CartaoDialog({
  open,
  onOpenChange,
  cartao,
  contas,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartao: Cartao | null
  contas: ContaPagadora[]
  onSaved: () => void
}) {
  const [nome, setNome] = useState(cartao?.name ?? '')
  const [limite, setLimite] = useState(cartao ? String(cartao.limit).replace('.', ',') : '')
  const [fechamento, setFechamento] = useState(cartao ? String(cartao.closing_day) : '')
  const [vencimento, setVencimento] = useState(cartao ? String(cartao.due_day) : '')
  const [pagadora, setPagadora] = useState(cartao?.default_payer_account_id ? String(cartao.default_payer_account_id) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const valor = lerValor(limite)
    const diaFechamento = Number(fechamento)
    const diaVencimento = Number(vencimento)
    if (valor === null) return setErro('Informe o limite como número, por exemplo 5.000,00.')
    if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31)
      return setErro('O dia de fechamento precisa estar entre 1 e 31.')
    if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31)
      return setErro('O dia de vencimento precisa estar entre 1 e 31.')

    setSalvando(true)
    setErro(null)
    const corpo = {
      name: nome,
      limit: valor,
      closing_day: diaFechamento,
      due_day: diaVencimento,
      // 0 remove a conta pagadora na edição; na criação vale "sem conta".
      default_payer_account_id: pagadora ? Number(pagadora) : 0,
    }
    try {
      if (cartao) {
        await api(`/api/cards/${cartao.id}`, { method: 'PATCH', body: corpo })
      } else {
        await api('/api/cards', { method: 'POST', body: { user_id: CURRENT_USER_ID, ...corpo } })
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o cartão.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cartao ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input id="cartao-nome" label="Nome (ex.: Nubank, Amex)" value={nome} onChange={setNome} error={erro ?? undefined} reserveErrorLine />
          <Input id="cartao-limite" label="Limite" inputMode="decimal" placeholder="0,00" value={limite} onChange={setLimite} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="cartao-fechamento" label="Dia de fechamento" inputMode="numeric" placeholder="1 a 31" value={fechamento} onChange={setFechamento} />
            <Input id="cartao-vencimento" label="Dia de vencimento" inputMode="numeric" placeholder="1 a 31" value={vencimento} onChange={setVencimento} />
          </div>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Conta pagadora (opcional)
            <select
              value={pagadora}
              onChange={(e) => setPagadora(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Nenhuma</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>
            {salvando ? 'Salvando...' : cartao ? 'Salvar' : 'Criar cartão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
