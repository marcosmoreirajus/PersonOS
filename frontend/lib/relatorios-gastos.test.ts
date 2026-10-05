import test from 'node:test'
import assert from 'node:assert/strict'

import { hrefLancamento } from './relatorios-gastos.ts'
import { lerUrl } from './transacoes-url.ts'

test('o gasto leva às Transações com a edição dele aberta', () => {
  assert.equal(hrefLancamento(42), '/finance/transactions?editar=42')
})

test('o que o link monta é lido de volta pela tela de Transações', () => {
  const href = hrefLancamento(7)
  const estado = lerUrl(href.slice(href.indexOf('?')))
  assert.equal(estado.editar, 7)
  assert.equal(estado.tipo, 'all')
  assert.deepEqual(estado.categorias, [])
})
