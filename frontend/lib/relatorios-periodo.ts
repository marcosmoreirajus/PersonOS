/**
 * Período de Relatórios pela URL (issue #14) — lógica pura, sem React.
 *
 * Só o que é da tela mora aqui: qual atalho está escolhido, como ele vai e
 * volta da URL e como a variação é escrita. A conta de intervalos e de
 * comparação (semana na segunda, mesmo trecho do anterior...) é do backend
 * (`app/services/relatorios.py`), num lugar só: a tela manda o atalho e a data
 * de hoje, e recebe os intervalos prontos.
 *
 *   periodo=<atalho>   ausente = este mês
 *   de=AAAA-MM-DD      só no personalizado
 *   ate=AAAA-MM-DD     só no personalizado
 *
 * Valor inválido cai no padrão em silêncio, nunca quebra a tela.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */

export type Atalho =
  | 'hoje'
  | 'semana'
  | 'mes'
  | 'mes_anterior'
  | 'ultimos_3_meses'
  | 'ultimos_6_meses'
  | 'ultimos_12_meses'
  | 'ano'
  | 'personalizado'

export const PADRAO: Atalho = 'mes'

/** Os atalhos na ordem em que aparecem no seletor. */
export const ATALHOS: { valor: Atalho; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes_anterior', rotulo: 'Mês anterior' },
  { valor: 'ultimos_3_meses', rotulo: 'Últimos 3 meses' },
  { valor: 'ultimos_6_meses', rotulo: 'Últimos 6 meses' },
  { valor: 'ultimos_12_meses', rotulo: 'Últimos 12 meses' },
  { valor: 'ano', rotulo: 'Este ano' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

export type PeriodoEscolhido = {
  atalho: Atalho
  /** `AAAA-MM-DD`; só no personalizado. */
  de: string | null
  ate: string | null
}

/** `AAAA-MM-DD` de um dia que existe (2026-02-30 não existe). */
function dataValida(texto: string | null): string | null {
  if (texto === null || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const d = new Date(`${texto}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto ? null : texto
}

/**
 * Lê o período da busca da URL. Personalizado sem as duas datas válidas (ou
 * com o intervalo invertido) não diz nada e volta ao padrão, em vez de pedir à
 * API um intervalo que ela recusaria.
 */
export function lerPeriodo(busca: string | URLSearchParams): PeriodoEscolhido {
  const p = typeof busca === 'string' ? new URLSearchParams(busca) : busca
  const cru = p.get('periodo')
  const atalho = ATALHOS.find((a) => a.valor === cru)?.valor ?? PADRAO
  if (atalho !== 'personalizado') return { atalho, de: null, ate: null }

  const de = dataValida(p.get('de'))
  const ate = dataValida(p.get('ate'))
  if (!de || !ate || de > ate) return { atalho: PADRAO, de: null, ate: null }
  return { atalho, de, ate }
}

/** Monta a busca da URL (com o "?", ou vazia no padrão): só entra o que foge do padrão. */
export function montarBuscaPeriodo(periodo: PeriodoEscolhido): string {
  if (periodo.atalho === PADRAO) return ''
  const p = new URLSearchParams()
  p.set('periodo', periodo.atalho)
  if (periodo.atalho === 'personalizado' && periodo.de && periodo.ate) {
    p.set('de', periodo.de)
    p.set('ate', periodo.ate)
  }
  return `?${p.toString()}`
}

/**
 * A variação contra o período anterior, em texto. Anterior zero ou vazio não
 * tem percentual: a API manda `null` e aparece "—" (nunca "novo" nem infinito).
 */
export function textoPercentual(percentual: number | null): string {
  if (percentual === null) return '—'
  const sinal = percentual > 0 ? '+' : percentual < 0 ? '−' : ''
  return `${sinal}${Math.abs(percentual).toFixed(1).replace('.', ',')}%`
}
