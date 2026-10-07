import test from 'node:test'
import assert from 'node:assert/strict'

import { cartaoInicial, corpoDoDestino, erroDoDestino, repeticaoNoDestino, repeticoesDoDestino } from './lancamento-destino.ts'

test('o cartão libera à vista e parcelado, mas não recorrente; a conta libera os três', () => {
  assert.deepEqual(repeticoesDoDestino('cartao'), ['avista', 'installment'])
  assert.deepEqual(repeticoesDoDestino('conta'), ['avista', 'installment', 'recurring'])
})

test('trocar para o cartão tira a recorrência e mantém o parcelado', () => {
  assert.equal(repeticaoNoDestino('cartao', 'recurring'), 'avista')
  assert.equal(repeticaoNoDestino('cartao', 'installment'), 'installment')
  assert.equal(repeticaoNoDestino('conta', 'recurring'), 'recurring')
})

test('destino Conta pede a conta; Cartão pede o cartão', () => {
  assert.equal(erroDoDestino('conta', '', '4'), 'Escolha a conta do lançamento.')
  assert.equal(erroDoDestino('conta', '3', ''), undefined)
  assert.equal(erroDoDestino('cartao', '3', ''), 'Escolha o cartão da compra.')
  assert.equal(erroDoDestino('cartao', '', '4'), undefined)
})

test('o corpo leva exatamente um dos dois campos', () => {
  assert.deepEqual(corpoDoDestino('conta', '3', '4'), { account_id: 3 })
  assert.deepEqual(corpoDoDestino('cartao', '3', '4'), { card_id: 4 })
})

test('só preseleciona o cartão quando há um único', () => {
  assert.equal(cartaoInicial([{ id: 8 }]), 8)
  assert.equal(cartaoInicial([{ id: 8 }, { id: 9 }]), null)
  assert.equal(cartaoInicial([]), null)
})
