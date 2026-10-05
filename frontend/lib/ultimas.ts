/**
 * Últimas transações da Visão Geral (issue #16) — lógica pura, sem React.
 *
 * A lista, a ordem e o limite vêm prontos da API (`app/services/ultimas.py`);
 * aqui só mora o agrupamento por dia, porque "Hoje" e "Ontem" dependem do
 * relógio local do cliente.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

function emMs(dia: string): number {
  return new Date(`${dia}T00:00:00Z`).getTime()
}

/** "Hoje", "Ontem" ou a data `DD/MM/AAAA`. `dia` e `hoje` são `AAAA-MM-DD`. */
export function rotuloDoDia(dia: string, hoje: string): string {
  const diferenca = Math.round((emMs(hoje) - emMs(dia)) / MS_POR_DIA)
  if (diferenca === 0) return 'Hoje'
  if (diferenca === 1) return 'Ontem'
  return new Date(emMs(dia)).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export type GrupoDoDia<T> = { dia: string; rotulo: string; itens: T[] }

/** Agrupa itens consecutivos do mesmo `day`, na ordem em que chegaram. */
export function agruparPorDia<T extends { day: string }>(itens: T[], hoje: string): GrupoDoDia<T>[] {
  const grupos: GrupoDoDia<T>[] = []
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === item.day) ultimo.itens.push(item)
    else grupos.push({ dia: item.day, rotulo: rotuloDoDia(item.day, hoje), itens: [item] })
  }
  return grupos
}
