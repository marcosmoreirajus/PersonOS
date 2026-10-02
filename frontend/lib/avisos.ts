/**
 * Avisos do sino de Finanças (issue #2) — lógica pura, sem React.
 *
 * Aviso é lembrete de **prazo** (GLOSSARY.md): em atraso e a vencer. "Sem
 * categoria" não é aviso; é fila de classificação e mora em "A revisar".
 *
 * O número do sino conta **pares (aviso, lançamento)** que não estão no
 * conjunto visto. Contar pares, e não tipos, é o que faz um lançamento que
 * passa de "a vencer" para "em atraso" voltar a chamar atenção, e o que
 * deixa a edição de valor de um item já visto passar em silêncio.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */

export type TipoAviso = 'em_atraso' | 'a_vencer'

/** Dias à frente além de hoje: 0 é só hoje; 7 vai até hoje + 7. */
export const JANELAS = [0, 1, 3, 7, 15] as const
export type JanelaAVencer = (typeof JANELAS)[number]

export type ParVisto = { aviso: TipoAviso; transaction_id: number }

/** Espelha `GET /api/preferences/user/{id}` (sem o `user_id`). */
export type Preferencias = {
  em_atraso: boolean
  a_vencer: boolean
  janela_a_vencer: JanelaAVencer
  visto: ParVisto[]
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  em_atraso: true,
  a_vencer: true,
  janela_a_vencer: 7,
  visto: [],
}

export type LancamentoAviso = {
  id: number
  type: 'income' | 'expense'
  amount: number
  due_date: string
  settled_at: string | null
}

export type Aviso = {
  tipo: TipoAviso
  /** Lançamentos envolvidos, na ordem de vencimento. */
  ids: number[]
  /** Em aberto, separado por sentido: somar entradas com saídas não diz nada. */
  aPagar: number
  aReceber: number
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function montar(tipo: TipoAviso, lista: LancamentoAviso[]): Aviso {
  const ordenada = [...lista].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
  const soma = (t: LancamentoAviso['type']) => ordenada.filter((l) => l.type === t).reduce((s, l) => s + l.amount, 0)
  return { tipo, ids: ordenada.map((l) => l.id), aPagar: soma('expense'), aReceber: soma('income') }
}

/**
 * Avisos ligados, com os lançamentos de cada um. `hoje` vem de fora
 * (`hojeLocal()` na tela) — o relógio local é a fonte, nunca o UTC.
 */
export function derivarAvisos(lancamentos: LancamentoAviso[], prefs: Preferencias, hoje: string): Aviso[] {
  const abertos = lancamentos.filter((l) => !l.settled_at)
  const limite = somarDias(hoje, prefs.janela_a_vencer)

  const avisos: Aviso[] = []
  if (prefs.em_atraso) {
    const atrasados = abertos.filter((l) => l.due_date < hoje)
    if (atrasados.length > 0) avisos.push(montar('em_atraso', atrasados))
  }
  if (prefs.a_vencer) {
    const aVencer = abertos.filter((l) => l.due_date >= hoje && l.due_date <= limite)
    if (aVencer.length > 0) avisos.push(montar('a_vencer', aVencer))
  }
  return avisos
}

/** Retrato dos pares atuais — é o que "marcar como visto" grava. */
export function paresDe(avisos: Aviso[]): ParVisto[] {
  return avisos.flatMap((a) => a.ids.map((id) => ({ aviso: a.tipo, transaction_id: id })))
}

const chave = (p: ParVisto) => `${p.aviso}:${p.transaction_id}`

/** O número do sino: pares atuais que não estavam no último visto. */
export function contarNaoVistos(avisos: Aviso[], visto: ParVisto[]): number {
  const vistos = new Set(visto.map(chave))
  return paresDe(avisos).filter((p) => !vistos.has(chave(p))).length
}

/** Fim da janela em texto corrido, para o título do aviso "a vencer". */
function rotuloJanela(janela: JanelaAVencer): string {
  if (janela === 0) return 'hoje'
  if (janela === 1) return 'até amanhã'
  return `nos próximos ${janela} dias`
}

/** Opção do seletor de janela em Configurações. */
export function opcaoJanela(janela: JanelaAVencer): string {
  if (janela === 0) return 'Só hoje'
  if (janela === 1) return 'Hoje e amanhã'
  return `Hoje e os próximos ${janela} dias`
}

export function tituloEmAtraso(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'lançamento' : 'lançamentos'} em atraso`
}

export function tituloAVencer(quantidade: number, janela: JanelaAVencer): string {
  return `${quantidade} ${quantidade === 1 ? 'vence' : 'vencem'} ${rotuloJanela(janela)}`
}
