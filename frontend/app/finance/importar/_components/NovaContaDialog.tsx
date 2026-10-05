'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/motion/input'
import { api } from '@/lib/api'
import { lerSaldo, saldoParaCampo } from '@/lib/contas-quadro'
import { cn } from '@/lib/utils'

export type ContaTipo = 'checking' | 'wallet' | 'savings' | 'investment'

export type Conta = {
  id: number
  name: string
  kind: ContaTipo
  initial_balance?: number
  logo?: string | null
}

export const TIPOS_CONTA: { value: ContaTipo; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
]

const LOGO_LADO = 128

/**
 * Reduz a imagem escolhida para um quadrado de 128px (PNG) antes de enviar:
 * o logo vai dentro do JSON da conta, então precisa ser pequeno.
 */
function reduzirLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = LOGO_LADO
      canvas.height = LOGO_LADO
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('sem canvas'))
      // "contain": mantém a proporção, sem cortar o logo.
      const escala = Math.min(LOGO_LADO / img.width, LOGO_LADO / img.height)
      const w = img.width * escala
      const h = img.height * escala
      ctx.drawImage(img, (LOGO_LADO - w) / 2, (LOGO_LADO - h) / 2, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagem inválida'))
    }
    img.src = url
  })
}

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
  const [nome, setNome] = useState(editando?.name ?? '')
  const [tipo, setTipo] = useState<ContaTipo>(editando?.kind ?? 'checking')
  const [saldo, setSaldo] = useState(saldoParaCampo(editando?.initial_balance))
  const [logo, setLogo] = useState<string | null>(editando?.logo ?? null)
  const inputLogo = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function escolherLogo(file: File | undefined) {
    if (!file) return
    try {
      setLogo(await reduzirLogo(file))
      setErro(null)
    } catch {
      setErro('Não foi possível ler essa imagem. Use PNG, JPG, WebP ou SVG.')
    }
  }

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
        const logoAntes = editando.logo ?? null
        conta = await api<Conta>(`/api/accounts/${editando.id}`, {
          method: 'PATCH',
          body: { name: nome, kind: tipo, initial_balance: valor, ...(logo !== logoAntes && { logo: logo ?? '' }) },
        })
      } else {
        conta = await api<Conta>('/api/accounts', {
          method: 'POST',
          body: { user_id: userId, name: nome, kind: tipo, initial_balance: valor, logo },
        })
        setNome('')
        setTipo('checking')
        setSaldo('')
        setLogo(null)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => inputLogo.current?.click()}
              aria-label={logo ? 'Trocar o logo' : 'Adicionar logo'}
              className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <input
              ref={inputLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                escolherLogo(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Input id="conta-nome" label="Nome (ex.: Bradesco, C6, BTG)" value={nome} onChange={setNome} error={erro ?? undefined} reserveErrorLine />
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" strokeWidth={1.5} aria-hidden="true" />
                  Remover logo
                </button>
              )}
            </div>
          </div>
          <Input id="conta-saldo" label="Saldo inicial" inputMode="decimal" placeholder="0,00" value={saldo} onChange={setSaldo} />
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
            {editando ? (salvando ? 'Salvando...' : 'Salvar') : salvando ? 'Criando...' : 'Criar conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
