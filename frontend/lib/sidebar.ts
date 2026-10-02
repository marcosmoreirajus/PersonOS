/**
 * Sidebar recolhida ou expandida — escolha do aparelho, como o tema.
 *
 * Fica em **cookie**, e não no `localStorage`, porque o servidor precisa
 * saber o estado para já desenhar a página certa: lido no cliente depois de
 * carregar, a sidebar abriria e fecharia a cada carga e a cada troca de
 * módulo (cada módulo monta o próprio `AppShell`).
 *
 * Fora de módulo `'use client'`: os layouts (server) importam daqui.
 */

export const SIDEBAR_COOKIE = 'personos-sidebar'

/** Sem cookie, a sidebar começa expandida. */
export function sidebarAberta(valor: string | undefined): boolean {
  return valor !== 'collapsed'
}

export function cookieDaSidebar(aberta: boolean): string {
  return `${SIDEBAR_COOKIE}=${aberta ? 'expanded' : 'collapsed'}; path=/; max-age=31536000; samesite=lax`
}
