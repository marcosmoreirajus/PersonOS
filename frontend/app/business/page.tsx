import { redirect } from 'next/navigation'

// O menu lateral aponta para /business, que não tinha página (404). A seção
// abre pela primeira aba do módulo.
export default function BusinessPage() {
  redirect('/business/founder')
}
