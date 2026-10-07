import test from 'node:test'
import assert from 'node:assert/strict'

import { chaveDaFatura, lerChave, rotuloDaOpcao } from './pagamento-fatura.ts'

test('a chave carrega cartão e ciclo e volta igual', () => {
  const chave = chaveDaFatura({ card_id: 3, cycle: '2026-08' })
  assert.equal(chave, '3|2026-08')
  assert.deepEqual(lerChave(chave), { card_id: 3, cycle: '2026-08' })
})

test('chave malformada não vira fatura', () => {
  assert.equal(lerChave(''), null)
  assert.equal(lerChave('x|2026-08'), null)
  assert.equal(lerChave('3'), null)
  assert.equal(lerChave('0|2026-08'), null)
})

test('o rótulo da opção diz o cartão e o mês da fatura', () => {
  assert.equal(rotuloDaOpcao({ card_name: 'Nubank', cycle: '2026-08' }), 'Nubank · Agosto de 2026')
})
