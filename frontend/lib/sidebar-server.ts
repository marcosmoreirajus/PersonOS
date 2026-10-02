import { cookies } from 'next/headers'

import { SIDEBAR_COOKIE, sidebarAberta } from './sidebar'

/**
 * Estado da sidebar lido do cookie, para o layout do módulo passar ao
 * `AppShell`. Usar `cookies()` deixa a rota dinâmica — custo aceito: é o que
 * evita a sidebar abrir e fechar a cada carga.
 */
export async function sidebarAbertaNoCookie(): Promise<boolean> {
  return sidebarAberta((await cookies()).get(SIDEBAR_COOKIE)?.value)
}
