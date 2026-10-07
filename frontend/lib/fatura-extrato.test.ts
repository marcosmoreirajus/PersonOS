import test from 'node:test'
import assert from 'node:assert/strict'

import { explicarDiferenca, lerTotalDigitado } from './fatura-extrato.ts'

test('diferença positiva aponta compra faltando; negativa, duplicidade', () => {
  assert.match(explicarDiferenca(50), /compra faltando/)
  assert.match(explicarDiferenca(-50), /duplicada/)
})

test('o total digitado aceita vírgula, vazio apaga e lixo é inválido', () => {
  assert.deepEqual(lerTotalDigitado('450,50'), { valor: 450.5, valido: true })
  assert.deepEqual(lerTotalDigitado(' 450 '), { valor: 450, valido: true })
  assert.deepEqual(lerTotalDigitado(''), { valor: null, valido: true })
  assert.deepEqual(lerTotalDigitado('abc'), { valor: null, valido: false })
  assert.deepEqual(lerTotalDigitado('-3'), { valor: null, valido: false })
})
