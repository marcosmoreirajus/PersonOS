import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PersonOS',
  description: 'Sistema integrado de gestão pessoal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
