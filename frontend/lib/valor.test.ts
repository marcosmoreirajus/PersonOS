import test from 'node:test'
import assert from 'node:assert/strict'

import { formatarValor, lerValor, valorParaCampo } from './valor.ts'

test('os milhares ganham ponto enquanto se digita', () => {
  assert.equal(formatarValor('1'), '1')
  assert.equal(formatarValor('12'), '12')
  assert.equal(formatarValor('123'), '123')
  assert.equal(formatarValor('1234'), '1.234')
  assert.equal(formatarValor('1234567'), '1.234.567')
})

test('a vírgula começa os centavos, com no máximo 2 casas', () => {
  assert.equal(formatarValor('1234,'), '1.234,')
  assert.equal(formatarValor('1234,5'), '1.234,5')
  assert.equal(formatarValor('1234,56'), '1.234,56')
  assert.equal(formatarValor('1234,567'), '1.234,56')
  assert.equal(formatarValor('1.234,5'), '1.234,5')
})

test('uma segunda vírgula não abre outra casa decimal', () => {
  assert.equal(formatarValor('12,3,4'), '12,34')
})

test('ponto digitado é ignorado e letras somem', () => {
  assert.equal(formatarValor('1.2.3'), '123')
  assert.equal(formatarValor('1a2b3'), '123')
})

test('zeros à esquerda saem e vírgula sozinha vira 0,', () => {
  assert.equal(formatarValor('05'), '5')
  assert.equal(formatarValor('000'), '0')
  assert.equal(formatarValor(','), '0,')
  assert.equal(formatarValor(',5'), '0,5')
})

test('apagar um dígito refaz os pontos', () => {
  // "1.234" com o último dígito apagado chega como "1.23".
  assert.equal(formatarValor('1.23'), '123')
})

test('vazio fica vazio', () => {
  assert.equal(formatarValor(''), '')
  assert.equal(formatarValor('abc'), '')
})

test('negativo só quando o campo permite', () => {
  assert.equal(formatarValor('-50'), '50')
  assert.equal(formatarValor('-50', true), '-50')
  assert.equal(formatarValor('-', true), '-')
  assert.equal(formatarValor('-1234,5', true), '-1.234,5')
  assert.equal(formatarValor('1-2', true), '12')
})

test('lê o valor em formato brasileiro', () => {
  assert.equal(lerValor('1.250,00'), 1250)
  assert.equal(lerValor('1250,5'), 1250.5)
  assert.equal(lerValor('0,99'), 0.99)
  assert.equal(lerValor(' -50,25 '), -50.25)
  assert.equal(lerValor('1.234,'), 1234)
})

test('vazio vale zero e o que não é número é recusado', () => {
  assert.equal(lerValor(''), 0)
  assert.equal(lerValor('abc'), null)
  assert.equal(lerValor('12,3,4'), null)
  assert.equal(lerValor('-'), null)
  assert.equal(lerValor(','), null)
})

test('o valor volta ao campo mascarado e lerValor o entende de volta', () => {
  assert.equal(valorParaCampo(1250.5), '1.250,50')
  assert.equal(valorParaCampo(-50), '-50,00')
  assert.equal(valorParaCampo(0), '')
  assert.equal(valorParaCampo(undefined), '')
  assert.equal(valorParaCampo(null), '')
  for (const v of [1250.5, -50, 0.07, 123456.78, 5000]) {
    assert.equal(lerValor(valorParaCampo(v)), v)
  }
})

test('o que a máscara produz é sempre o que lerValor lê', () => {
  for (const digitado of ['1', '12,5', '1234', '1234,56', '9999999,99']) {
    const campo = formatarValor(digitado)
    assert.notEqual(lerValor(campo), null)
  }
})
