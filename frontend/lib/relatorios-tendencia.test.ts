/**
 * Geometria do gráfico de tendência de Relatórios (issue #18). Roda com `npm test`.
 * Os pontos e as somas vêm prontos do backend; aqui só a escala do eixo.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { escalaDoEixo, semMovimento } from './relatorios-tendencia.ts'

const ponto = (receita: number, despesa: number) => ({ receita, despesa, resultado: receita - despesa })

test('o eixo inclui o zero e fecha em números redondos', () => {
  const e = escalaDoEixo([ponto(1000, 300), ponto(0, 40)])
  assert.equal(e.min, -500)
  assert.equal(e.max, 1000)
  assert.deepEqual(e.marcas, [-500, 0, 500, 1000])
  assert.deepEqual(escalaDoEixo([ponto(1000, 0)]).marcas, [0, 250, 500, 750, 1000])
})

test('resultado negativo estende o eixo para baixo', () => {
  const e = escalaDoEixo([ponto(100, 300)])
  assert.equal(e.min, -200)
  assert.equal(e.max, 400)
  assert.ok(e.marcas.includes(0))
})

test('o teto sobe para o próximo passo redondo', () => {
  const e = escalaDoEixo([ponto(1234.5, 0)])
  assert.equal(e.max, 1500)
  assert.equal(e.min, 0)
})

test('tudo zero ainda dá um eixo válido', () => {
  const e = escalaDoEixo([ponto(0, 0)])
  assert.ok(e.max > e.min)
})

test('semMovimento: só quando todo ponto tem receita e despesa zeradas', () => {
  assert.equal(semMovimento([]), true)
  assert.equal(semMovimento([ponto(0, 0), ponto(0, 0)]), true)
  assert.equal(semMovimento([ponto(0, 0), ponto(0, 0.01)]), false)
})
