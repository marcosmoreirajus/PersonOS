'use client'

import { useState } from 'react'
import { Check, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BANDEIRAS,
  CORES,
  ICONES,
  INSTITUICOES,
  logoDaConta,
  valorIcone,
  valorInstituicao,
  type Instituicao,
} from '@/lib/conta-logos'
import { cn } from '@/lib/utils'
import { LogoConta } from './LogoConta'

export type AbaIcone = 'bandeiras' | 'instituicoes' | 'personalizados'

const ROTULO_ABA: Record<AbaIcone, string> = {
  bandeiras: 'Bandeiras',
  instituicoes: 'Instituições financeiras',
  personalizados: 'Ícones personalizados',
}

/** Botão redondo com o selo e o nome embaixo; marca o escolhido. Hover: só um aro em volta do círculo. */
function Opcao({
  logo,
  nome,
  escolhido,
  onClick,
}: {
  logo: string
  nome: string
  escolhido: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={escolhido}
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          'relative rounded-full p-0.5 ring-offset-2 ring-offset-popover transition-shadow',
          escolhido ? 'ring-2 ring-foreground' : 'group-hover:ring-2 group-hover:ring-foreground/40'
        )}
      >
        <LogoConta logo={logo} className="size-14 text-sm" />
        {escolhido && (
          <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className={cn('text-xs leading-tight', escolhido ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {nome}
      </span>
    </button>
  )
}

/**
 * Segunda tela dos diálogos de conta e de cartão: escolher o ícone numa
 * coleção fechada — uma instituição, uma bandeira de cartão, ou um ícone
 * personalizado numa cor da paleta. `abas` diz quais abas aparecem (a conta
 * não mostra bandeiras). Só confirma ao clicar em "Selecionar ícone";
 * "Voltar" descarta a escolha.
 */
export function EscolherIcone({
  atual,
  abas,
  descricao,
  onVoltar,
  onSelecionar,
}: {
  atual: string | null
  abas: AbaIcone[]
  descricao: string
  onVoltar: () => void
  onSelecionar: (valor: string) => void
}) {
  const atualValido = logoDaConta(atual) ? atual : null
  const comecaPersonalizado = Boolean(atualValido?.startsWith('icone:'))
  const comecaBandeira = BANDEIRAS.some((b) => atualValido === valorInstituicao(b.chave))
  // Abre na aba do que já está escolhido; sem escolha, na primeira aba da lista.
  const abaInicial: AbaIcone = comecaPersonalizado
    ? 'personalizados'
    : comecaBandeira
      ? 'bandeiras'
      : atualValido?.startsWith('catalogo:')
        ? 'instituicoes'
        : abas[0]
  const [aba, setAba] = useState<AbaIcone>(abaInicial)
  const [busca, setBusca] = useState('')
  const [catalogo, setCatalogo] = useState<string | null>(atualValido?.startsWith('catalogo:') ? atualValido : null)
  const [icone, setIcone] = useState<string | null>(comecaPersonalizado ? (atualValido?.split(':')[1] ?? null) : null)
  const [cor, setCor] = useState<string>(comecaPersonalizado ? (atualValido?.split(':')[2] ?? CORES[0]) : CORES[0])

  const termo = busca.trim().toLowerCase()
  const fonte: Instituicao[] = aba === 'bandeiras' ? BANDEIRAS : INSTITUICOES
  const lista = fonte.filter((i) => i.nome.toLowerCase().includes(termo))
  const escolha = aba === 'personalizados' ? (icone ? valorIcone(icone, cor) : null) : catalogo

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Selecione o ícone</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
      </DialogHeader>

      <div
        role="tablist"
        aria-label="Tipo de ícone"
        className="grid gap-1 rounded-xl border border-border bg-muted p-1"
        style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}
      >
        {abas.map((chave) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            onClick={() => setAba(chave)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              aba === chave ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {ROTULO_ABA[chave]}
          </button>
        ))}
      </div>

      {aba !== 'personalizados' ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 focus-within:ring-3 focus-within:ring-ring/30">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar"
              aria-label="Pesquisar"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="grid max-h-80 grid-cols-4 gap-x-2 gap-y-3 overflow-y-auto pr-1 sm:grid-cols-5">
            {lista.map((i) => {
              const v = valorInstituicao(i.chave)
              return <Opcao key={i.chave} logo={v} nome={i.nome} escolhido={catalogo === v} onClick={() => setCatalogo(v)} />
            })}
            {lista.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
          </div>
        </div>
      ) : (
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap justify-center gap-5">
            {ICONES.map((i) => (
              <Opcao
                key={i.chave}
                logo={valorIcone(i.chave, cor)}
                nome={i.nome}
                escolhido={icone === i.chave}
                onClick={() => setIcone(i.chave)}
              />
            ))}
          </div>
          <div role="group" aria-label="Cor do ícone" className="grid grid-cols-6 gap-3 px-1 pb-1">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor #${c}`}
                aria-pressed={cor === c}
                onClick={() => setCor(c)}
                style={{ backgroundColor: '#' + c }}
                className={cn(
                  'mx-auto size-10 cursor-pointer rounded-full border border-black/5 outline-none ring-offset-2 ring-offset-popover transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                  cor === c ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-foreground/40'
                )}
              />
            ))}
          </div>
        </div>
      )}

      <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-2 sm:justify-between">
        <Button variant="outline" size="lg" onClick={onVoltar}>
          Voltar
        </Button>
        <Button size="lg" disabled={!escolha} onClick={() => escolha && onSelecionar(escolha)}>
          Selecionar ícone
        </Button>
      </DialogFooter>
    </>
  )
}
