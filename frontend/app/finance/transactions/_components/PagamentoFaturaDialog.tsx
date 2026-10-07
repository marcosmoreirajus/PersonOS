'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MoneyValue } from '@/components/ui/money-value'
import { api } from '@/lib/api'
import { chaveDaFatura, lerChave, type OpcoesDePagamento } from '@/lib/pagamento-fatura'
import { SeletorDeFatura } from '../../_components/SeletorDeFatura'

/**
 * Marcar à mão uma saída da conta como pagamento de fatura (issue #29). É a
 * saída para o que o app não sugeriu: o valor pago é o da própria linha, então
 * pagamento parcial é só escolher a fatura.
 */
export function PagamentoFaturaDialog({
  transaction,
  onOpenChange,
  onSaved,
}: {
  transaction: { id: number; description: string | null; amount: number } | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [dados, setDados] = useState<OpcoesDePagamento | null>(null)
  const [escolha, setEscolha] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const id = transaction?.id

  useEffect(() => {
    if (id === undefined) return
    let cancelado = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- zera o diálogo ao abrir outro lançamento
    setDados(null)
    setErro(null)
    api<OpcoesDePagamento>(`/api/invoice-payments/${id}/options`)
      .then((d) => {
        if (cancelado) return
        setDados(d)
        setEscolha(d.padrao ? chaveDaFatura(d.padrao) : null)
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível carregar as faturas.'))
    return () => {
      cancelado = true
    }
  }, [id])

  async function confirmar() {
    const fatura = escolha ? lerChave(escolha) : null
    if (!transaction || !fatura) return
    setSaving(true)
    setErro(null)
    try {
      await api(`/api/invoice-payments/${transaction.id}`, { method: 'POST', body: fatura })
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(transaction)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento de fatura</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {transaction?.description ?? 'Esta saída'} (<MoneyValue value={transaction?.amount ?? 0} />) deixa de ser despesa e vira
          pagamento da fatura escolhida. O valor pago é o desta saída; se for menos que o total, a fatura fica parcialmente paga.
        </p>

        {!dados && !erro && <p className="text-sm text-muted-foreground">Carregando faturas...</p>}
        {dados && dados.opcoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma fatura fechada com valor a pagar na data desta saída.</p>
        )}
        {dados && dados.opcoes.length > 0 && (
          <SeletorDeFatura opcoes={dados.opcoes} value={escolha} onChange={setEscolha} rotulo="Fatura paga" />
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
          <Button onClick={confirmar} pending={saving} disabled={!escolha}>
            {saving ? 'Registrando...' : 'Marcar como pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
