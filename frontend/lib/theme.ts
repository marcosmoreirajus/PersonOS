/**
 * Tema claro/escuro/sistema — escolha do aparelho, salva no `localStorage`
 * (não nas preferências do backend: o mesmo usuário pode querer escuro no
 * celular e claro no desktop).
 *
 * Fora de módulo `'use client'` de propósito: o layout raiz (server) importa
 * o script daqui, e export de módulo client chegaria lá como referência, não
 * como string.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'personos-theme'

/**
 * Aplica o tema salvo antes da primeira pintura. Roda inline no `<head>`:
 * sem isso, quem escolheu escuro vê um flash claro até a hidratação — e o
 * tema só seria aplicado nas telas que montam o seletor.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var d=c==='dark'||(c!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`
