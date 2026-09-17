import { Home, Landmark, Repeat, type LucideIcon } from 'lucide-react'

export type ScheduledType = 'conta_fixa' | 'imposto' | 'assinatura'
export type ScheduledStatus = 'pending' | 'paid' | 'overdue'

export type ScheduledItem = {
  id: number
  name: string
  type: ScheduledType
  value: number
  due_date: string
  status: 'pending' | 'paid'
}

export const TYPE_META: Record<ScheduledType, { label: string; color: string; icon: LucideIcon }> = {
  conta_fixa: { label: 'Conta fixa', color: '#5b7c99', icon: Home },
  imposto: { label: 'Imposto', color: '#7c8c63', icon: Landmark },
  assinatura: { label: 'Assinatura', color: '#a8674f', icon: Repeat },
}

/** Deriva o status efetivo (paid/pending/overdue) comparando due_date com hoje. */
export function effectiveStatus(item: ScheduledItem, today: Date): ScheduledStatus {
  if (item.status === 'paid') return 'paid'
  const due = new Date(`${item.due_date}T00:00:00`)
  return due < today ? 'overdue' : 'pending'
}
