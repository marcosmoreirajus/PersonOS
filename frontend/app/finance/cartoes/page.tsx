import { redirect } from 'next/navigation'

/**
 * Os cartões moram na página Contas e cartões (`/finance/contas`). Esta rota
 * fica só para não quebrar links e favoritos antigos.
 */
export default function CartoesPage() {
  redirect('/finance/contas')
}
