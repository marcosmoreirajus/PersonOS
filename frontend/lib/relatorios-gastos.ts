/**
 * Maiores gastos de Relatórios (issue #19) — lógica pura, sem React.
 *
 * A lista, a ordem e o limite vêm prontos da API (`app/services/relatorios.py`);
 * só o link mora aqui.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */
import { FILTROS_VAZIOS, montarBusca } from './transacoes-url.ts'

/** Transações com a edição do lançamento aberta (mecanismo da issue #6). */
export function hrefLancamento(id: number): string {
  return `/finance/transactions${montarBusca({ ...FILTROS_VAZIOS, editar: id })}`
}
