'use client'

import { MoneyValue } from '@/components/ui/money-value'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { chaveDaFatura, rotuloDaOpcao, type OpcaoFatura } from '@/lib/pagamento-fatura'

/**
 * Escolha da fatura que uma saída da conta está pagando (issue #29). Mostra o
 * que falta pagar em cada uma, para o pagamento parcial ficar à vista.
 */
export function SeletorDeFatura({
  opcoes,
  value,
  onChange,
  rotulo,
}: {
  opcoes: OpcaoFatura[]
  value: string | null
  onChange: (chave: string) => void
  rotulo: string
}) {
  const itens = opcoes.map((o) => ({ value: chaveDaFatura(o), label: rotuloDaOpcao(o) }))
  return (
    <Select items={itens} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" className="w-full sm:w-72" aria-label={rotulo}>
        <SelectValue placeholder="Escolher a fatura..." />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={chaveDaFatura(o)} value={chaveDaFatura(o)}>
            <span className="flex w-full items-center justify-between gap-3">
              {rotuloDaOpcao(o)}
              <span className="text-xs text-muted-foreground">
                falta <MoneyValue value={o.remaining} />
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
