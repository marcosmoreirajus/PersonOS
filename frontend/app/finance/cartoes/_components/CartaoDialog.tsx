'use client'

import { useState } from 'react'
import { ImagePlus, Info, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CampoValor } from '@/components/ui/campo-valor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/motion/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { fraseDoCiclo, limparDia } from '@/lib/ciclo-cartao'
import { logoDaConta } from '@/lib/conta-logos'
import { lerValor, valorParaCampo } from '@/lib/valor'
import { cn } from '@/lib/utils'
import { EscolherIcone } from '../../_components/EscolherIcone'
import { LogoConta } from '../../_components/LogoConta'

export type Cartao = {
  id: number
  name: string
  limit: number
  closing_day: number
  due_day: number
  default_payer_account_id: number | null
  logo?: string | null
}

export type ContaPagadora = { id: number; name: string; logo?: string | null }

const AJUDA_PAGADORA =
  'A conta que paga a fatura deste cartão por padrão. É opcional: dá para deixar sem conta e escolher depois.'

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
  const logoInicial = logoDaConta(cartao?.logo) ? (cartao?.logo ?? null) : null
  const [vista, setVista] = useState<'form' | 'icone'>('form')
  const [nome, setNome] = useState(cartao?.name ?? '')
  const [logo, setLogo] = useState<string | null>(logoInicial)
  const [limite, setLimite] = useState(valorParaCampo(cartao?.limit))
  const [fechamento, setFechamento] = useState(cartao ? String(cartao.closing_day) : '')
  const [vencimento, setVencimento] = useState(cartao ? String(cartao.due_day) : '')
  const [pagadora, setPagadora] = useState(cartao?.default_payer_account_id ? String(cartao.default_payer_account_id) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const ciclo = fraseDoCiclo(fechamento, vencimento)

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
      // No PATCH, logo ausente = não mexe; "" = remove.
      ...(cartao ? (logo !== logoInicial ? { logo: logo ?? '' } : {}) : { logo }),
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
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (!aberto) setVista('form')
        onOpenChange(aberto)
      }}
    >
      <DialogContent className={cn('gap-5 p-6 sm:max-w-md', vista === 'icone' && 'sm:max-w-lg')}>
        {vista === 'icone' ? (
          <EscolherIcone
            atual={logo}
            abas={['bandeiras', 'instituicoes', 'personalizados']}
            descricao="Escolha o ícone que representa este cartão"
            onVoltar={() => setVista('form')}
            onSelecionar={(v) => {
              setLogo(v)
              setVista('form')
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{cartao ? 'Editar cartão' : 'Novo cartão manual'}</DialogTitle>
              <DialogDescription>
                {cartao ? 'Altere os dados deste cartão' : 'Preencha os dados do cartão que você deseja criar'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-2">
              {/* Hover: só um aro em volta do círculo — o mesmo da conta e das opções de ícone. */}
              <button
                type="button"
                onClick={() => setVista('icone')}
                aria-label={logo ? 'Trocar o ícone' : 'Selecionar um ícone'}
                className="flex size-24 cursor-pointer items-center justify-center rounded-full border border-border bg-muted text-muted-foreground outline-none ring-offset-2 ring-offset-popover transition-shadow hover:ring-2 hover:ring-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {logo ? (
                  <LogoConta logo={logo} className="size-[5.5rem] text-xl" />
                ) : (
                  <ImagePlus className="size-8" strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
              {logo ? (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" strokeWidth={1.5} aria-hidden="true" />
                  Remover ícone
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">Selecione um ícone</span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Input
                id="cartao-nome"
                label="Nome do cartão *"
                placeholder="Insira um nome para identificar este cartão"
                value={nome}
                onChange={setNome}
                error={erro ?? undefined}
                reserveErrorLine
              />
              <CampoValor id="cartao-limite" label="Limite" placeholder="R$ 0,00" value={limite} onChange={setLimite} />

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="cartao-fechamento"
                    label="Fecha dia"
                    inputMode="numeric"
                    placeholder="1 a 31"
                    value={fechamento}
                    onChange={(t) => setFechamento(limparDia(t))}
                  />
                  <Input
                    id="cartao-vencimento"
                    label="Vence dia"
                    inputMode="numeric"
                    placeholder="1 a 31"
                    value={vencimento}
                    onChange={(t) => setVencimento(limparDia(t))}
                  />
                </div>
                {/* Mostra, com os dias digitados, em que fatura cai uma compra — a regra é a mesma do backend. */}
                <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
                  {ciclo ?? 'Informe os dias para ver em qual fatura cai cada compra.'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-sm text-foreground">
                  Conta de pagamento padrão
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Sobre a conta de pagamento padrão"
                          className="text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      }
                    >
                      <Info className="size-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-center leading-snug">
                      {AJUDA_PAGADORA}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Conta de pagamento padrão">
                  {[{ id: 0, name: 'Nenhuma', logo: null }, ...contas].map((c) => {
                    const escolhida = (c.id === 0 && pagadora === '') || String(c.id) === pagadora
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={escolhida}
                        onClick={() => setPagadora(c.id === 0 ? '' : String(c.id))}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                          escolhida
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                        )}
                      >
                        <LogoConta logo={c.logo} className="size-5 text-[8px]" />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-1 sm:justify-between">
              <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button size="lg" onClick={salvar} pending={salvando} disabled={!nome.trim()}>
                {salvando ? 'Salvando...' : cartao ? 'Salvar' : 'Criar novo cartão'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
