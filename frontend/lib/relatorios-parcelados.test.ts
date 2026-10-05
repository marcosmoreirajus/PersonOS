import test from 'node:test'
import assert from 'node:assert/strict'

import { lerAba, mesAno, montarBuscaRelatorios } from './relatorios-parcelados.ts'
import { lerPeriodo } from './relatorios-periodo.ts'

test('sem aba na URL, vale o Resumo; valor desconhecido também', () => {
  assert.equal(lerAba(''), 'resumo')
  assert.equal(lerAba('?aba=parcelados'), 'parcelados')
  assert.equal(lerAba('?aba=outra'), 'resumo')
})

test('o padrão (Resumo, este mês) deixa a URL limpa', () => {
  assert.equal(montarBuscaRelatorios('resumo', lerPeriodo('')), '')
})

test('a aba Parcelados entra na URL sem perder o período', () => {
  assert.equal(montarBuscaRelatorios('parcelados', lerPeriodo('')), '?aba=parcelados')
  const periodo = lerPeriodo('?periodo=personalizado&de=2026-09-01&ate=2026-09-30')
  const busca = montarBuscaRelatorios('parcelados', periodo)
  assert.equal(lerAba(busca), 'parcelados')
  assert.deepEqual(lerPeriodo(busca), periodo)
})

test('voltar ao Resumo tira só a aba e mantém o período', () => {
  const periodo = lerPeriodo('?periodo=ano')
  assert.equal(montarBuscaRelatorios('resumo', periodo), '?periodo=ano')
})

test('o término aparece como mês e ano', () => {
  assert.equal(mesAno('2027-02-20'), 'fev/2027')
  assert.equal(mesAno('2026-12-01'), 'dez/2026')
})
