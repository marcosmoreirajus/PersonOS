'use client'

import { useEffect } from 'react'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'

import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemeChoice } from '@/lib/theme'
import { criarPreferenciaDoNavegador } from '@/lib/hooks/use-preferencia-do-navegador'
import { cn } from '@/lib/utils'

function applyTheme(choice: ThemeChoice) {
  const isDark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

function lerTemaSalvo(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

// Sem localStorage (ou no servidor), "system".
const useTema = criarPreferenciaDoNavegador<ThemeChoice>({
  ler: lerTemaSalvo,
  gravar: (tema) => localStorage.setItem(STORAGE_KEY, tema),
  servidor: 'system',
})

const OPTIONS: { value: ThemeChoice; icon: LucideIcon; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Tema claro' },
  { value: 'dark', icon: Moon, label: 'Tema escuro' },
  { value: 'system', icon: Monitor, label: 'Tema do sistema' },
]

/**
 * Controle de tema claro/escuro/sistema — decisão de 2026-09-14: o app
 * precisa de um controle explícito, não só seguir o SO. Alterna a classe
 * `.dark` na raiz (os tokens em `.dark` já existem no design-tokens.css).
 *
 * Mora em Configurações > Aparência (02/10). Aplicar o tema salvo na carga
 * é do script inline do layout raiz (`lib/theme.ts`), não deste componente:
 * ele só aparece numa tela.
 */
function ThemeToggle() {
  const [choice, setChoice] = useTema()

  // Reaplica o salvo ao montar. Lê o storage direto, e não `choice`: no render
  // de hidratação `choice` ainda é o "system" do servidor.
  useEffect(() => {
    try {
      applyTheme(lerTemaSalvo())
    } catch {
      applyTheme('system')
    }
  }, [])

  function choose(next: ThemeChoice) {
    applyTheme(next)
    setChoice(next)
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
