import test from 'node:test'
import assert from 'node:assert/strict'

import { rotuloDaParcela, rotuloDoCiclo, rotuloDoEstado } from './faturas.ts'

test('a parcela vira "2/12"; compra à vista não tem rótulo', () => {
  assert.equal(rotuloDaParcela({ installment: { index: 2, count: 12 } }), '2/12')
  assert.equal(rotuloDaParcela({}), null)
})

test('o ciclo vira mês e ano por extenso', () => {
  assert.equal(rotuloDoCiclo('2026-10'), 'Outubro de 2026')
  assert.equal(rotuloDoCiclo('2027-01'), 'Janeiro de 2027')
  assert.equal(rotuloDoCiclo('2026-03'), 'Março de 2026')
})

test('ciclo malformado volta como veio', () => {
  assert.equal(rotuloDoCiclo('2026-13'), '2026-13')
  assert.equal(rotuloDoCiclo('xx'), 'xx')
})

test('os quatro estados têm rótulo', () => {
  assert.equal(rotuloDoEstado('open'), 'Aberta')
  assert.equal(rotuloDoEstado('closed'), 'Fechada')
  assert.equal(rotuloDoEstado('partially_paid'), 'Parcialmente paga')
  assert.equal(rotuloDoEstado('paid'), 'Paga')
})
