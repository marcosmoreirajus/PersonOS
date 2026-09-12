import { Inter } from 'next/font/google'

/**
 * Config da fonte Inter via next/font/google — o jeito ideal de carregar a
 * fonte em um projeto Next.js (self-hosted, zero layout shift, sem round
 * trip pro Google Fonts em runtime).
 *
 * Este arquivo NÃO está aplicado em app/layout.tsx ainda de propósito: outro
 * agente pode estar editando esse arquivo em paralelo (páginas de negócio),
 * e dois agentes escrevendo no mesmo arquivo ao mesmo tempo causa conflito.
 * Enquanto isso, app/globals.css já carrega a Inter via @import do Google
 * Fonts diretamente, então a fonte funciona normalmente sem isso.
 *
 * Para migrar para a versão otimizada (próxima sessão / integração final),
 * em app/layout.tsx:
 *
 *   import { inter } from '@/lib/fonts'
 *
 *   export default function RootLayout({ children }: { children: React.ReactNode }) {
 *     return (
 *       <html lang="pt-BR" className={inter.variable}>
 *         <body>{children}</body>
 *       </html>
 *     )
 *   }
 *
 * A variável CSS `--font-inter` gerada por essa config já é consumida em
 * `frontend/styles/design-tokens.css` (--font-sans: var(--font-inter, 'Inter', ...)),
 * então assim que o className acima for aplicado no <html>, a troca é
 * automática — nenhum outro arquivo precisa mudar.
 */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
