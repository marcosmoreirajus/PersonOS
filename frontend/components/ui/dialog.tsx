'use client'

import * as React from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = BaseDialog.Root
const DialogTrigger = BaseDialog.Trigger
const DialogClose = BaseDialog.Close

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof BaseDialog.Popup>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/20 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
      <BaseDialog.Popup
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-tl-card-cut border border-border bg-card p-5 text-card-foreground shadow-lg outline-none',
          'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity',
          className
        )}
        {...props}
      >
        <DialogClose className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </DialogClose>
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) {
  return <BaseDialog.Title className={cn('text-base font-medium text-foreground', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle }
