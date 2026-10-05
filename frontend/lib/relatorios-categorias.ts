/**
 * Despesas por categoria de Relatórios (issue #17) — lógica pura, sem React.
 *
 * Só o link mora aqui; os valores, variações e o percentual do balde vêm
 * prontos da API (`app/services/relatorios.py`).
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */
import { FILTROS_VAZIOS, montarBusca } from './transacoes-url.ts'

/** Transações filtradas pelas saídas da categoria no período (`de`..`ate`, inclusivos). */
export function hrefCategoria(categoryId: number, periodo: { de: string; ate: string }): string {
  const busca = montarBusca({
    ...FILTROS_VAZIOS,
    editar: null,
    tipo: 'expense',
    categorias: [String(categoryId)],
    de: periodo.de,
    ate: periodo.ate,
  })
  return `/finance/transactions${busca}`
}
