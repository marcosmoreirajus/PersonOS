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

/**
 * Modo da sidebar: `fixo` (recolhe e expande pelo botão, e fica como deixou)
 * ou `auto` (sempre recolhida; expande por cima do conteúdo ao passar o
 * mouse). Também do aparelho, também em cookie, pelo mesmo motivo.
 */
export const SIDEBAR_MODE_COOKIE = 'personos-sidebar-modo'
export type SidebarMode = 'fixo' | 'auto'

export function modoDaSidebar(valor: string | undefined): SidebarMode {
  return valor === 'auto' ? 'auto' : 'fixo'
}

export function cookieDoModo(modo: SidebarMode): string {
  return `${SIDEBAR_MODE_COOKIE}=${modo}; path=/; max-age=31536000; samesite=lax`
}

/** Lê um cookie no navegador (para a tela de Configurações mostrar o atual). */
export function lerCookie(nome: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nome}=`))
    ?.slice(nome.length + 1)
}

/** Sem cookie, a sidebar começa expandida. */
export function sidebarAberta(valor: string | undefined): boolean {
  return valor !== 'collapsed'
}

export function cookieDaSidebar(aberta: boolean): string {
  return `${SIDEBAR_COOKIE}=${aberta ? 'expanded' : 'collapsed'}; path=/; max-age=31536000; samesite=lax`
}
