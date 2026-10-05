import test from 'node:test'
import assert from 'node:assert/strict'

import { contaInicial, guardarUltimaConta, lerUltimaConta } from './conta-lancamento.ts'

const contas = [{ id: 3 }, { id: 7 }]

/** Armazenamento em memória com a mesma forma do `localStorage`. */
function memoria(inicial: Record<string, string> = {}) {
  const dados = { ...inicial }
  return {
    dados,
    getItem: (k: string) => (k in dados ? dados[k] : null),
    setItem: (k: string, v: string) => {
      dados[k] = v
    },
  }
}

test('guarda e lê a última conta, separada por usuário', () => {
  const s = memoria()
  guardarUltimaConta(s, 1, 7)
  guardarUltimaConta(s, 2, 3)
  assert.equal(lerUltimaConta(s, 1), 7)
  assert.equal(lerUltimaConta(s, 2), 3)
  assert.equal(lerUltimaConta(s, 9), null)
})

test('valor guardado inválido vira nulo', () => {
  assert.equal(lerUltimaConta(memoria({ 'personos:ultima-conta:1': 'abc' }), 1), null)
  assert.equal(lerUltimaConta(memoria({ 'personos:ultima-conta:1': '0' }), 1), null)
  assert.equal(lerUltimaConta(memoria({ 'personos:ultima-conta:1': '' }), 1), null)
})

test('sem armazenamento, ou com armazenamento que lança, não quebra', () => {
  const quebrado = {
    getItem: () => {
      throw new Error('bloqueado')
    },
    setItem: () => {
      throw new Error('bloqueado')
    },
  }
  assert.equal(lerUltimaConta(null, 1), null)
  assert.equal(lerUltimaConta(quebrado, 1), null)
  assert.doesNotThrow(() => guardarUltimaConta(quebrado, 1, 3))
  assert.doesNotThrow(() => guardarUltimaConta(null, 1, 3))
})

test('a conta inicial é a última usada, se ela ainda existe', () => {
  assert.equal(contaInicial(contas, 7), 7)
  assert.equal(contaInicial(contas, 3), 3)
})

test('última conta apagada ou desconhecida: só preseleciona se houver uma única conta', () => {
  assert.equal(contaInicial(contas, 99), null)
  assert.equal(contaInicial(contas, null), null)
  assert.equal(contaInicial([{ id: 5 }], null), 5)
  assert.equal(contaInicial([{ id: 5 }], 99), 5)
  assert.equal(contaInicial([], 7), null)
})
