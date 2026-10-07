'use client'

import { useState } from 'react'
import { ImagePlus, Info, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/motion/input'
import { CampoValor } from '@/components/ui/campo-valor'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { lerSaldo, saldoParaCampo } from '@/lib/contas-quadro'
import { logoDaConta } from '@/lib/conta-logos'
import { cn } from '@/lib/utils'
import { EscolherIcone } from '../../_components/EscolherIcone'
import { LogoConta } from '../../_components/LogoConta'

export type ContaTipo = 'checking' | 'wallet' | 'savings' | 'investment'

export type Conta = {
  id: number
  name: string
  kind: ContaTipo
  initial_balance?: number
  logo?: string | null
  /** Dinheiro guardado: o saldo não entra no Saldo Geral. */
  exclude_from_total?: boolean
}

export const TIPOS_CONTA: { value: ContaTipo; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
]

const AJUDA_FORA_DO_TOTAL =
  'Marque esta opção para que o saldo desta conta não seja somado no seu Saldo Geral. O saldo continua sendo contabilizado nos lançamentos e relatórios. Use para contas que representem seu dinheiro guardado, como Poupança ou Investimento.'

/**
 * Cria uma conta sem sair de onde o usuário está (importação, Visão Geral).
 * Com `conta`, edita essa conta: o pai monta o diálogo com `key` diferente por
 * conta, para os campos nascerem preenchidos.
 */
export function NovaContaDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
  conta: editando,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  /** Chamado com a conta criada ou, na edição, a conta atualizada. */
  onCreated: (c: Conta) => void
  conta?: Conta
}) {
  const logoInicial = logoDaConta(editando?.logo) ? (editando?.logo ?? null) : null
  const [vista, setVista] = useState<'form' | 'icone'>('form')
  const [nome, setNome] = useState(editando?.name ?? '')
  const [tipo, setTipo] = useState<ContaTipo>(editando?.kind ?? 'checking')
  const [saldo, setSaldo] = useState(saldoParaCampo(editando?.initial_balance))
  const [logo, setLogo] = useState<string | null>(logoInicial)
  const [foraDoTotal, setForaDoTotal] = useState(Boolean(editando?.exclude_from_total))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const valor = lerSaldo(saldo)
    if (valor === null) {
      setErro('Informe o saldo como número, por exemplo 1.250,00.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      let conta: Conta
      if (editando) {
        // No PATCH, logo ausente = não mexe; "" = remove.
        conta = await api<Conta>(`/api/accounts/${editando.id}`, {
          method: 'PATCH',
          body: {
            name: nome,
            kind: tipo,
            initial_balance: valor,
            exclude_from_total: foraDoTotal,
            ...(logo !== logoInicial && { logo: logo ?? '' }),
          },
        })
      } else {
        conta = await api<Conta>('/api/accounts', {
          method: 'POST',
          body: { user_id: userId, name: nome, kind: tipo, initial_balance: valor, logo, exclude_from_total: foraDoTotal },
        })
        setNome('')
        setTipo('checking')
        setSaldo('')
        setLogo(null)
        setForaDoTotal(false)
      }
      onCreated(conta)
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.')
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
            abas={['instituicoes', 'personalizados']}
            descricao="Escolha o ícone que representa esta conta"
            onVoltar={() => setVista('form')}
            onSelecionar={(v) => {
              setLogo(v)
              setVista('form')
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editando ? 'Editar conta' : 'Nova conta manual'}</DialogTitle>
              <DialogDescription>
                {editando ? 'Altere os dados desta conta' : 'Preencha os dados da conta que você deseja criar'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-2">
              {/* Hover: só um aro em volta do círculo — o mesmo das opções da tela de escolha. */}
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
                id="conta-nome"
                label="Nome da conta *"
                placeholder="Insira um nome para identificar esta conta"
                value={nome}
                onChange={setNome}
                error={erro ?? undefined}
                reserveErrorLine
              />
              <CampoValor
                id="conta-saldo"
                label="Saldo da conta"
                placeholder="R$ 0,00"
                value={saldo}
                onChange={setSaldo}
                permitirNegativo
              />
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
                      tipo === t.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Switch id="conta-fora-do-total" checked={foraDoTotal} onCheckedChange={setForaDoTotal} />
                <label htmlFor="conta-fora-do-total" className="cursor-pointer text-sm text-foreground">
                  Não somar no Saldo Geral
                </label>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Sobre não somar no Saldo Geral"
                        className="text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    }
                  >
                    <Info className="size-4" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-center leading-snug">
                    {AJUDA_FORA_DO_TOTAL}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-1 sm:justify-between">
              <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button size="lg" onClick={salvar} pending={salvando} disabled={!nome.trim()}>
                {editando ? (salvando ? 'Salvando...' : 'Salvar') : salvando ? 'Criando...' : 'Criar nova conta'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
