import test from 'node:test'
import assert from 'node:assert/strict'

import { lerSaldo, saldoParaCampo } from './contas-quadro.ts'

test('lê o saldo em formato brasileiro', () => {
  assert.equal(lerSaldo('1.250,00'), 1250)
  assert.equal(lerSaldo('1250,5'), 1250.5)
  assert.equal(lerSaldo('0,99'), 0.99)
  assert.equal(lerSaldo(' -50,25 '), -50.25)
})

test('vazio vale zero e texto que não é número é recusado', () => {
  assert.equal(lerSaldo(''), 0)
  assert.equal(lerSaldo('   '), 0)
  assert.equal(lerSaldo('abc'), null)
  assert.equal(lerSaldo('12,3,4'), null)
  assert.equal(lerSaldo('-'), null)
  assert.equal(lerSaldo(','), null)
})

test('o saldo volta ao campo no mesmo formato que lerSaldo entende', () => {
  assert.equal(saldoParaCampo(1250.5), '1250,50')
  assert.equal(saldoParaCampo(-50), '-50,00')
  assert.equal(saldoParaCampo(0), '')
  assert.equal(saldoParaCampo(undefined), '')
  for (const v of [1250.5, -50, 0.07, 123456.78]) {
    assert.equal(lerSaldo(saldoParaCampo(v)), v)
  }
})
