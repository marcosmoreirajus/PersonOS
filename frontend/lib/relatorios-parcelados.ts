/**
 * Abas de Relatórios e aba Parcelados (issue #20) — lógica pura, sem React.
 *
 * A conta (total, restantes, falta, total comprometido) vem pronta da API
 * (`app/services/relatorios_parcelados.py`); aqui moram a aba escolhida na URL
 * e os textos de data.
 *
 *   aba=parcelados   ausente = Resumo
 *
 * A aba convive com o período: ao trocar de aba, `periodo`/`de`/`ate` seguem na
 * URL (Parcelados não os usa, mas voltar ao Resumo não perde o que foi escolhido).
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */
import { montarBuscaPeriodo, type PeriodoEscolhido } from './relatorios-periodo.ts'

export type Aba = 'resumo' | 'parcelados'

export const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'resumo', rotulo: 'Resumo' },
  { valor: 'parcelados', rotulo: 'Parcelados' },
]

/** A aba da busca da URL; valor desconhecido cai em Resumo, em silêncio. */
export function lerAba(busca: string | URLSearchParams): Aba {
  const p = typeof busca === 'string' ? new URLSearchParams(busca) : busca
  return p.get('aba') === 'parcelados' ? 'parcelados' : 'resumo'
}

/** A busca da URL de Relatórios (com o "?", ou vazia no padrão): período e aba. */
export function montarBuscaRelatorios(aba: Aba, periodo: PeriodoEscolhido): string {
  const p = new URLSearchParams(montarBuscaPeriodo(periodo))
  if (aba !== 'resumo') p.set('aba', aba)
  const texto = p.toString()
  return texto ? `?${texto}` : ''
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** O mês de uma data `AAAA-MM-DD`, para o término: `2027-02-20` vira `fev/2027`. */
export function mesAno(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`
}
