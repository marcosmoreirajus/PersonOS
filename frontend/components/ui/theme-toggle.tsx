'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'personos-theme'

function applyTheme(choice: ThemeChoice) {
  const isDark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

const OPTIONS: { value: ThemeChoice; icon: LucideIcon; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Tema claro' },
  { value: 'dark', icon: Moon, label: 'Tema escuro' },
  { value: 'system', icon: Monitor, label: 'Tema do sistema' },
]

/**
 * Controle de tema claro/escuro/sistema — decisão de 2026-09-14: o app
 * precisa de um controle explícito, não só seguir o SO. Alterna a classe
 * `.dark` na raiz (os tokens em `.dark` já existem no design-tokens.css).
 */
function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system')

  useEffect(() => {
    let saved: ThemeChoice = 'system'
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark' || stored === 'system') saved = stored
    } catch {
      // localStorage indisponível — mantém o default "system".
    }
    setChoice(saved)
    applyTheme(saved)
  }, [])

  function choose(next: ThemeChoice) {
    setChoice(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignora — a preferência só não persiste entre sessões.
    }
  }

  return (
    <div role="group" aria-label="Tema" className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={choice === value}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            'flex size-7 items-center justify-center rounded-full transition-colors',
            choice === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

export { ThemeToggle }
