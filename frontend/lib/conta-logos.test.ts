import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { BANDEIRAS, CORES, ICONES, INSTITUICOES, logoDaConta, textoSobre, valorIcone, valorInstituicao } from './conta-logos.ts'

// As listas do frontend e as do backend (as que o servidor valida) têm de ser
// as mesmas: item só de um lado ou é recusado ao salvar ou nunca aparece.
const py = readFileSync(new URL('../../backend/app/conta_logos.py', import.meta.url), 'utf8')

function itensDoBackend(nome: string): string[] {
  const bloco = py.slice(py.indexOf(`${nome} = frozenset(`))
  const fim = bloco.search(/\r?\n\r?\n/) // cada coleção termina numa linha em branco (LF ou CRLF)
  return [...bloco.slice(0, fim).matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1])
}

test('as instituições do frontend são as mesmas do backend', () => {
  assert.deepEqual(INSTITUICOES.map((i) => i.chave).sort(), itensDoBackend('INSTITUICOES').sort())
})

test('as bandeiras do frontend são as mesmas do backend', () => {
  assert.deepEqual(BANDEIRAS.map((i) => i.chave).sort(), itensDoBackend('BANDEIRAS').sort())
})

test('os ícones do frontend são os mesmos do backend', () => {
  assert.deepEqual(ICONES.map((i) => i.chave).sort(), itensDoBackend('ICONES').sort())
})

test('a paleta do frontend é a mesma do backend', () => {
  assert.deepEqual([...CORES].sort(), itensDoBackend('CORES').sort())
})

test('chaves e cores são únicas', () => {
  const todas = [...INSTITUICOES, ...BANDEIRAS].map((i) => i.chave)
  assert.equal(new Set(todas).size, todas.length)
  assert.equal(new Set(CORES).size, CORES.length)
})

test('logoDaConta lê instituição e ícone com cor, e ignora o que não é da coleção', () => {
  assert.equal(logoDaConta(valorInstituicao('nubank'))?.nome, 'Nubank')
  const ic = logoDaConta(valorIcone('cofrinho', 'ffe600'))
  assert.equal(ic?.nome, 'Cofrinho')
  assert.equal(ic?.fundo, '#ffe600')
  assert.equal(logoDaConta(valorInstituicao('visa'))?.nome, 'Visa')
  assert.equal(logoDaConta('catalogo:inexistente'), null)
  assert.equal(logoDaConta('icone:aviao:ffe600'), null)
  assert.equal(logoDaConta('icone:banco:123456'), null)
  assert.equal(logoDaConta('data:image/png;base64,AAAA'), null)
  assert.equal(logoDaConta(null), null)
})

test('o texto sobre a cor é escuro em fundo claro e claro em fundo escuro', () => {
  assert.equal(textoSobre('#ffe600'), '#1a1a1a')
  assert.equal(textoSobre('#333333'), '#ffffff')
})
