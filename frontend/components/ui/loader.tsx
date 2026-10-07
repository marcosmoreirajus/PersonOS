'use client'

// Adaptado de @beui/loader (beui.dev/components/motion/loader): só as três
// variantes sóbrias (spinner, dots, bars). As outras 14 (ascii, scramble,
// metaballs, helix...) são vistosas demais para um app financeiro. Usa
// currentColor, escala por `size` e, com movimento reduzido, troca todo
// transform por um pulso de opacidade.

import { motion, useReducedMotion } from 'motion/react'

import { EASE_IN_OUT } from '@/lib/ease'
import { cn } from '@/lib/utils'

export type LoaderVariant = 'spinner' | 'dots' | 'bars'

export interface LoaderProps {
  variant?: LoaderVariant
  /** Lado do quadrado base, em px. Tudo escala a partir dele. */
  size?: number
  /** Segundos por ciclo. */
  speed?: number
  /** Texto lido por leitores de tela. */
  label?: string
  className?: string
}

interface PartProps {
  size: number
  speed: number
  reduce: boolean
}

const PULSO = { opacity: [1, 0.4, 1] }
const PULSO_TRANSICAO = { duration: 1.4, ease: EASE_IN_OUT, repeat: Infinity }

export function Loader({ variant = 'spinner', size = 32, speed = 1, label = 'Carregando', className }: LoaderProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center text-foreground', className)}>
      {variant === 'spinner' && <Spinner size={size} speed={speed} reduce={reduce} />}
      {variant === 'dots' && <Dots size={size} speed={speed} reduce={reduce} />}
      {variant === 'bars' && <Bars size={size} speed={speed} reduce={reduce} />}
      <span className="sr-only">{label}</span>
    </span>
  )
}

function Spinner({ size, speed, reduce }: PartProps) {
  const stroke = Math.max(2, size * 0.09)
  const r = (size - stroke) / 2
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      animate={reduce ? PULSO : { rotate: 360 }}
      transition={reduce ? PULSO_TRANSICAO : { duration: speed, ease: 'linear', repeat: Infinity }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <path
        d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </motion.svg>
  )
}

function Dots({ size, speed, reduce }: PartProps) {
  const dot = size * 0.24
  return (
    <span className="flex items-center" style={{ gap: size * 0.14 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="rounded-full bg-current"
          style={{ width: dot, height: dot }}
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { y: [0, -size * 0.3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: speed, ease: EASE_IN_OUT, repeat: Infinity, delay: i * speed * 0.16 }}
        />
      ))}
    </span>
  )
}

function Bars({ size, speed, reduce }: PartProps) {
  const bar = size * 0.16
  return (
    <span className="flex items-center" style={{ gap: size * 0.1, height: size }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="rounded-full bg-current"
          style={{ width: bar, height: size, originY: 1 }}
          animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scaleY: [0.3, 1, 0.3] }}
          transition={{ duration: speed, ease: EASE_IN_OUT, repeat: Infinity, delay: i * speed * 0.12 }}
        />
      ))}
    </span>
  )
}
