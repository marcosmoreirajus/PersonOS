import { LayoutGrid, List } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ViewMode = 'grid' | 'list'

export interface ViewToggleProps {
  value: ViewMode
  onChange: (value: ViewMode) => void
  className?: string
}

/**
 * Par de botões ícone (grid / lista) para trocar o modo de visualização de
 * uma listagem de cards. Uso:
 *
 *   const [view, setView] = useState<ViewMode>('grid')
 *   <ViewToggle value={view} onChange={setView} />
 *   <CardGrid view={view}>...</CardGrid>
 */
function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const options: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { mode: 'grid', label: 'Visualizar em grid', icon: LayoutGrid },
    { mode: 'list', label: 'Visualizar em lista', icon: List },
  ]

  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1',
        className
      )}
    >
      {options.map(({ mode, label, icon: Icon }) => {
        const isActive = value === mode
        return (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onChange(mode)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export { ViewToggle }
