'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { CURRENT_USER_ID, api } from '@/lib/api'

const CHAVE = 'clari:ultima-extensao'

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

/**
 * Roda a janela das séries na virada do mês, na primeira abertura do app.
 *
 * **Por que aqui e não no servidor:** o MVP não tem processo rodando sozinho,
 * então não há cron. E por que não a cada carregamento de tela: recalcular
 * geração em toda navegação é custo sem retorno — a janela só muda quando o
 * mês vira.
 *
 * **Por que bloqueia a renderização:** as páginas buscam dados ao montar. Se a
 * extensão rodasse em paralelo, a tela mostraria a lista antiga e o usuário
 * veria os lançamentos novos só no próximo refresh. Como isso acontece **uma
 * vez por mês** — nas outras vezes o efeito sai no primeiro `if`, sem rede —,
 * o custo é aceitável e a alternativa (recarregar a página depois) seria pior.
 */
export function SeriesExtensionGate({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const mes = mesAtual()
    let cancelado = false

    async function estender() {
      let ultima: string | null = null
      try {
        ultima = localStorage.getItem(CHAVE)
      } catch {
        // Navegador sem storage: estende toda vez. É idempotente, então o
        // pior caso é uma requisição a mais, não dado duplicado.
      }

      if (ultima === mes) {
        setPronto(true)
        return
      }

      try {
        // O mês só é marcado depois que a extensão aconteceu de fato: marcar
        // antes (o que acontecia quando a resposta do `fetch` era ignorada)
        // fazia uma falha 500 deixar o mês como resolvido, e a janela das
        // séries não era mais estendida até o mês virar.
        await api('/api/series/extend', { method: 'POST', body: { user_id: CURRENT_USER_ID } })
        try {
          localStorage.setItem(CHAVE, mes)
        } catch {
          // idem
        }
      } catch {
        // Falhar a extensão não pode impedir o app de abrir: o usuário
        // continua vendo o que já está materializado. E o mês não fica
        // marcado, então a próxima abertura tenta de novo.
      } finally {
        if (!cancelado) setPronto(true)
      }
    }

    estender()
    return () => {
      cancelado = true
    }
  }, [])

  if (!pronto) {
    return (
      <div className="p-8 text-sm text-muted-foreground" role="status">
        Atualizando lançamentos recorrentes...
      </div>
    )
  }

  return <>{children}</>
}

export default SeriesExtensionGate
