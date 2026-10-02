import { cookies } from 'next/headers'

import { SIDEBAR_COOKIE, SIDEBAR_MODE_COOKIE, modoDaSidebar, sidebarAberta, type SidebarMode } from './sidebar'

/**
 * Estado e modo da sidebar lidos do cookie, para o layout do módulo passar
 * ao `AppShell`. Usar `cookies()` deixa a rota dinâmica — custo aceito: é o
 * que evita a sidebar abrir e fechar a cada carga.
 */
export async function sidebarDoCookie(): Promise<{ sidebarOpen: boolean; sidebarMode: SidebarMode }> {
  const jar = await cookies()
  return {
    sidebarOpen: sidebarAberta(jar.get(SIDEBAR_COOKIE)?.value),
    sidebarMode: modoDaSidebar(jar.get(SIDEBAR_MODE_COOKIE)?.value),
  }
}
