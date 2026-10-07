'use client'

import { useLayoutEffect, useRef } from 'react'

import { Input, type InputProps } from '@/components/motion/input'
import { formatarValor } from '@/lib/valor'

/** Quantos caracteres "que contam" (dígito, vírgula, sinal) há em `texto` até `ate`. */
function significativosAte(texto: string, ate: number): number {
  return texto.slice(0, ate).replace(/[^\d,-]/g, '').length
}

/** Posição em `texto` logo depois do `n`-ésimo caractere que conta. */
function posicaoDepoisDe(texto: string, n: number): number {
  if (n <= 0) return 0
  let vistos = 0
  for (let i = 0; i < texto.length; i++) {
    if (/[\d,-]/.test(texto[i])) vistos++
    if (vistos === n) return i + 1
  }
  return texto.length
}

type CampoValorProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** O texto do campo, já mascarado ("1.250,50"). */
  value: string
  onChange: (valor: string) => void
  /** Aceita sinal de menos (saldo inicial pode ser negativo). */
  permitirNegativo?: boolean
}

/**
 * Campo de valor em reais com máscara ao digitar: os milhares ganham ponto
 * sozinhos e a vírgula começa os centavos (ver `lib/valor.ts`). O cursor fica
 * onde estava mesmo quando a máscara muda o tamanho do texto, então dá para
 * corrigir um dígito no meio sem o cursor pular para o fim. Use `lerValor`
 * para obter o número.
 */
export function CampoValor({ value, onChange, permitirNegativo = false, placeholder = '0,00', ...rest }: CampoValorProps) {
  const ref = useRef<HTMLInputElement>(null)
  const cursor = useRef<number | null>(null)

  // Depois que o React escreve o texto mascarado, devolve o cursor ao lugar.
  useLayoutEffect(() => {
    if (cursor.current === null || !ref.current) return
    const pos = posicaoDepoisDe(value, cursor.current)
    ref.current.setSelectionRange(pos, pos)
    cursor.current = null
  }, [value])

  return (
    <Input
      {...rest}
      ref={ref}
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(texto) => {
        const el = ref.current
        // `selectionStart` ainda reflete o texto cru que o usuário acabou de digitar.
        if (el && el.selectionStart !== null) cursor.current = significativosAte(texto, el.selectionStart)
        onChange(formatarValor(texto, permitirNegativo))
        // Se a máscara devolve o mesmo texto (tecla ignorada), o React não re-renderiza
        // e o efeito acima não roda: um quadro depois, repõe o cursor do mesmo jeito.
        requestAnimationFrame(() => {
          const campo = ref.current
          if (cursor.current === null || !campo) return
          const pos = posicaoDepoisDe(campo.value, cursor.current)
          campo.setSelectionRange(pos, pos)
          cursor.current = null
        })
      }}
    />
  )
}
