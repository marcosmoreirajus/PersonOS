import * as React from 'react'

import { cn } from '@/lib/utils'
import type { ViewMode } from '@/components/ui/view-toggle'

export interface CardGridProps extends React.ComponentProps<'div'> {
  view: ViewMode
}

/**
 * Wrapper que organiza os children (normalmente <Card />) em grid ou em
 * lista vertical, conforme `view`. Combine com <ViewToggle /> para deixar
 * o usuário trocar o modo:
 *
 *   <ViewToggle value={view} onChange={setView} />
 *   <CardGrid view={view}>
 *     {items.map((item) => <Card key={item.id}>...</Card>)}
 *   </CardGrid>
 */
function CardGrid({ view, className, children, ...props }: CardGridProps) {
  return (
    <div
      className={cn(
        view === 'grid'
          ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'
          : 'flex flex-col gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { CardGrid }
