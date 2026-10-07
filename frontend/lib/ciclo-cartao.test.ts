import test from 'node:test'
import assert from 'node:assert/strict'

import { fraseDoCiclo, limparDia } from './ciclo-cartao.ts'

test('o dia fica com no máximo 2 dígitos, entre 1 e 31', () => {
  assert.equal(limparDia('7'), '7')
  assert.equal(limparDia('25'), '25')
  assert.equal(limparDia('255'), '25')
  assert.equal(limparDia('45'), '31')
  assert.equal(limparDia('0'), '')
  assert.equal(limparDia('00'), '')
  assert.equal(limparDia('abc'), '')
  assert.equal(limparDia('1a2'), '12')
  assert.equal(limparDia(''), '')
})

test('vencimento depois do fechamento cai no mesmo mês', () => {
  assert.equal(fraseDoCiclo('5', '15'), 'Compras feitas até o dia 5 entram na fatura que vence dia 15 do mesmo mês.')
})

test('vencimento antes (ou no mesmo dia) do fechamento cai no mês seguinte', () => {
  assert.equal(fraseDoCiclo('25', '5'), 'Compras feitas até o dia 25 entram na fatura que vence dia 5 do mês seguinte.')
  assert.equal(fraseDoCiclo('10', '10'), 'Compras feitas até o dia 10 entram na fatura que vence dia 10 do mês seguinte.')
})

test('sem os dois dias válidos, não há frase', () => {
  assert.equal(fraseDoCiclo('', '5'), null)
  assert.equal(fraseDoCiclo('5', ''), null)
  assert.equal(fraseDoCiclo('32', '5'), null)
  assert.equal(fraseDoCiclo('0', '5'), null)
})
