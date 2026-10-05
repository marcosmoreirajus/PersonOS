/**
 * Transações pela URL (issue #6) — lógica pura, sem React.
 *
 * O que a tela mostra (um lançamento em edição, uma lista filtrada) é
 * descrito por parâmetros da URL, para qualquer outro lugar do app poder levar
 * até lá com um link. Os nomes são estáveis porque Visão Geral e Relatórios
 * geram esses links:
 *
 *   editar=<id>             abre a edição do lançamento
 *   q=<texto>               busca por descrição
 *   tipo=entrada | saida    só entradas ou só saídas
 *   categoria=<id>          repetível: uma ou mais categorias
 *   de=AAAA-MM-DD           data inicial (inclusive)
 *   ate=AAAA-MM-DD          data final (inclusive)
 *
 * Valor inválido ou desconhecido é ignorado em silêncio, nunca quebra a tela.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */

export type TipoFiltro = 'all' | 'income' | 'expense'

export type FiltrosTransacoes = {
  /** Texto da busca, como digitado. */
  q: string
  tipo: TipoFiltro
  /** Identificadores de categoria, como texto. Lista vazia = todas. */
  categorias: string[]
  /** `AAAA-MM-DD`, inclusive. */
  de: string | null
  ate: string | null
}

export type EstadoUrl = FiltrosTransacoes & {
  /** Lançamento a editar, ou nulo. */
  editar: number | null
}

export const FILTROS_VAZIOS: FiltrosTransacoes = { q: '', tipo: 'all', categorias: [], de: null, ate: null }

const TIPO_NA_URL: Record<Exclude<TipoFiltro, 'all'>, string> = { income: 'entrada', expense: 'saida' }

function inteiroPositivo(texto: string | null): number | null {
  if (texto === null || !/^[0-9]+$/.test(texto)) return null
  const n = Number(texto)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** `AAAA-MM-DD` de um dia que existe (2026-02-30 não existe). */
function dataValida(texto: string | null): string | null {
  if (texto === null || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const d = new Date(`${texto}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto ? null : texto
}

/** Lê a busca da URL (com ou sem o "?", ou um `URLSearchParams`). */
export function lerUrl(busca: string | URLSearchParams): EstadoUrl {
  const p = typeof busca === 'string' ? new URLSearchParams(busca) : busca

  const tipoCru = p.get('tipo')
  const tipo: TipoFiltro = tipoCru === 'entrada' ? 'income' : tipoCru === 'saida' ? 'expense' : 'all'

  const categorias: string[] = []
  for (const c of p.getAll('categoria')) {
    if (inteiroPositivo(c) !== null && !categorias.includes(c)) categorias.push(c)
  }

  let de = dataValida(p.get('de'))
  let ate = dataValida(p.get('ate'))
  // Intervalo invertido não diz nada: ignora as duas pontas.
  if (de && ate && de > ate) {
    de = null
    ate = null
  }

  return { editar: inteiroPositivo(p.get('editar')), q: p.get('q') ?? '', tipo, categorias, de, ate }
}

/** Monta a busca da URL (com o "?", ou vazia): só entra o que foi escolhido. */
export function montarBusca(estado: EstadoUrl): string {
  const p = new URLSearchParams()
  if (estado.editar !== null) p.set('editar', String(estado.editar))
  if (estado.q.trim()) p.set('q', estado.q)
  if (estado.tipo !== 'all') p.set('tipo', TIPO_NA_URL[estado.tipo])
  for (const c of estado.categorias) p.append('categoria', c)
  if (estado.de) p.set('de', estado.de)
  if (estado.ate) p.set('ate', estado.ate)
  const texto = p.toString()
  return texto ? `?${texto}` : ''
}

/**
 * Se `data` cai no intervalo `de`..`ate`, as duas pontas inclusivas. Ponta
 * ausente é aberta. Lê só os 10 primeiros caracteres (a data), como `formatDateBR`.
 */
export function dentroDoIntervalo(data: string, de: string | null, ate: string | null): boolean {
  const dia = data.slice(0, 10)
  if (de && dia < de) return false
  if (ate && dia > ate) return false
  return true
}

/** Das categorias pedidas pela URL, só as que existem, na mesma ordem. */
export function categoriasConhecidas(pedidas: string[], conhecidas: Iterable<number | string>): string[] {
  const existentes = new Set([...conhecidas].map(String))
  return pedidas.filter((id) => existentes.has(id))
}
