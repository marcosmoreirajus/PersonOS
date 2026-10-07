'use client'

import { useEffect } from 'react'

import { AnimatedToastStack, useAnimatedToastStack } from '@/components/motion/animated-toast-stack'
import { subscribeToApiOperationToasts } from '@/lib/api'

/** Mostra o estado das operações de gravação em uma pilha única no app todo. */
export function ApiToastStack() {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({
    defaultDuration: 4200,
    limit: 5,
  })

  useEffect(() => subscribeToApiOperationToasts((toast) => {
    if (toast.status === 'loading') {
      showToast({
        id: toast.id,
        title: toast.title,
        status: 'loading',
        duration: 0,
      })
      return
    }

    if (toast.status === 'dismiss') {
      dismissToast(toast.id)
      return
    }

    updateToast(toast.id, {
      title: toast.title,
      description: toast.description,
      status: toast.status,
      duration: toast.status === 'error' ? 6500 : 3200,
    })
  }), [dismissToast, showToast, updateToast])

  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      fixed
      maxVisible={4}
    />
  )
}
