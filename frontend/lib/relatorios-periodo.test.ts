/**
 * Período de Relatórios pela URL (issue #14). Roda com `npm test`.
 * A conta dos intervalos é do backend (`testa_relatorios.py`); aqui só a URL e o texto.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { lerPeriodo, montarBuscaPeriodo, textoPercentual, ATALHOS } from './relatorios-periodo.ts'

test('sem parâmetro o período é este mês', () => {
  assert.deepEqual(lerPeriodo(''), { atalho: 'mes', de: null, ate: null })
  assert.deepEqual(lerPeriodo('?'), { atalho: 'mes', de: null, ate: null })
})

test('cada atalho do seletor é lido da URL', () => {
  for (const { valor } of ATALHOS.filter((a) => a.valor !== 'personalizado')) {
    assert.deepEqual(lerPeriodo(`?periodo=${valor}`), { atalho: valor, de: null, ate: null })
  }
})

test('os nove atalhos pedidos estão no seletor, com este mês no meio', () => {
  assert.deepEqual(
    ATALHOS.map((a) => a.valor),
    ['hoje', 'semana', 'mes', 'mes_anterior', 'ultimos_3_meses', 'ultimos_6_meses', 'ultimos_12_meses', 'ano', 'personalizado'],
  )
})

test('atalho desconhecido cai no padrão', () => {
  assert.equal(lerPeriodo('?periodo=quinzena').atalho, 'mes')
})

test('personalizado lê de e ate', () => {
  assert.deepEqual(lerPeriodo('?periodo=personalizado&de=2026-09-10&ate=2026-09-19'), {
    atalho: 'personalizado',
    de: '2026-09-10',
    ate: '2026-09-19',
  })
})

test('personalizado incompleto, inexistente ou invertido volta ao padrão', () => {
  assert.equal(lerPeriodo('?periodo=personalizado').atalho, 'mes')
  assert.equal(lerPeriodo('?periodo=personalizado&de=2026-09-10').atalho, 'mes')
  assert.equal(lerPeriodo('?periodo=personalizado&de=2026-02-30&ate=2026-03-05').atalho, 'mes')
  assert.equal(lerPeriodo('?periodo=personalizado&de=2026-09-19&ate=2026-09-10').atalho, 'mes')
})

test('de e ate fora do personalizado são ignorados', () => {
  assert.deepEqual(lerPeriodo('?periodo=ano&de=2026-09-10&ate=2026-09-19'), { atalho: 'ano', de: null, ate: null })
})

test('o padrão não escreve nada na URL; o resto escreve o atalho', () => {
  assert.equal(montarBuscaPeriodo({ atalho: 'mes', de: null, ate: null }), '')
  assert.equal(montarBuscaPeriodo({ atalho: 'semana', de: null, ate: null }), '?periodo=semana')
  assert.equal(
    montarBuscaPeriodo({ atalho: 'personalizado', de: '2026-09-10', ate: '2026-09-19' }),
    '?periodo=personalizado&de=2026-09-10&ate=2026-09-19',
  )
})

test('ler o que foi montado devolve o mesmo período', () => {
  const p = { atalho: 'personalizado', de: '2026-01-01', ate: '2026-03-31' } as const
  assert.deepEqual(lerPeriodo(montarBuscaPeriodo(p)), p)
})

test('percentual: anterior sem percentual aparece como traço, nunca "novo"', () => {
  assert.equal(textoPercentual(null), '—')
})

test('percentual: sinal e vírgula decimal', () => {
  assert.equal(textoPercentual(25), '+25,0%')
  assert.equal(textoPercentual(-75), '−75,0%')
  assert.equal(textoPercentual(47.1), '+47,1%')
  assert.equal(textoPercentual(0), '0,0%')
})
