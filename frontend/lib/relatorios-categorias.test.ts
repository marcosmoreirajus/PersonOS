/**
 * Issue #17: o link de cada categoria de "Despesas por categoria" até as
 * Transações, filtradas por categoria e período. Os parâmetros (`tipo`,
 * `categoria`, `de`, `ate`) são os estáveis da issue #6. Roda com `npm test`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hrefCategoria } from './relatorios-categorias.ts'
import { lerUrl } from './transacoes-url.ts'

test('a categoria leva às Transações, só saídas, nela e no período', () => {
  assert.equal(
    hrefCategoria(3, { de: '2026-10-01', ate: '2026-10-03' }),
    '/finance/transactions?tipo=saida&categoria=3&de=2026-10-01&ate=2026-10-03'
  )
})

test('o que o link monta é lido de volta pela tela de Transações', () => {
  const href = hrefCategoria(12, { de: '2026-09-01', ate: '2026-09-30' })
  const estado = lerUrl(href.slice(href.indexOf('?')))
  assert.deepEqual(estado.categorias, ['12'])
  assert.equal(estado.tipo, 'expense')
  assert.equal(estado.de, '2026-09-01')
  assert.equal(estado.ate, '2026-09-30')
  assert.equal(estado.editar, null)
})
