import { Menu } from '@base-ui/react/menu'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface ActionsMenuAction {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

export interface ActionsMenuProps {
  actions: ActionsMenuAction[]
  label?: string
}

/**
 * Botão único "⋯" que abre um menu com ícone fixo por ação — em vez de
 * links de texto soltos (que variam de largura e quebram alinhamento entre
 * linhas de uma lista). O chamador decide quais ações mandar por item;
 * nem todo item precisa das mesmas ações.
 */
function ActionsMenu({ actions, label = 'Ações' }: ActionsMenuProps) {
  if (actions.length === 0) return null

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end">
          <Menu.Popup className="min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            {actions.map((action) => (
              <Menu.Item
                key={action.key}
                onClick={action.onSelect}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium outline-none',
                  'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                  action.destructive ? 'text-destructive' : 'text-secondary-foreground'
                )}
              >
                <action.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export { ActionsMenu }
