/**
 * Critérios de aceite da issue #6: a tela de Transações é endereçável pela URL
 * (abrir um lançamento para editar e abrir a lista já filtrada). Aqui, a lógica
 * pura de ler e montar os parâmetros. Roda com `npm test`.
 *
 * Nomes dos parâmetros (estáveis, porque Visão Geral e Relatórios geram links):
 * `editar`, `q`, `tipo` (entrada | saida), `categoria` (repetível), `de`, `ate`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FILTROS_VAZIOS,
  categoriasConhecidas,
  dentroDoIntervalo,
  lerUrl,
  montarBusca,
  type EstadoUrl,
} from './transacoes-url.ts'

const VAZIO: EstadoUrl = { editar: null, ...FILTROS_VAZIOS }

test('sem parâmetros: nada aberto e nenhum filtro', () => {
  assert.deepEqual(lerUrl(''), VAZIO)
  assert.deepEqual(lerUrl('?'), VAZIO)
})

test('aceita a busca com ou sem o "?" e um URLSearchParams', () => {
  assert.equal(lerUrl('?editar=42').editar, 42)
  assert.equal(lerUrl('editar=42').editar, 42)
  assert.equal(lerUrl(new URLSearchParams('editar=42')).editar, 42)
})

test('editar: só um identificador inteiro positivo vale', () => {
  assert.equal(lerUrl('?editar=7').editar, 7)
  for (const ruim of ['abc', '0', '-3', '4.5', '', '12abc', '1e3']) {
    assert.equal(lerUrl(`?editar=${ruim}`).editar, null, `editar=${ruim}`)
  }
})

test('tipo: entrada e saida viram income e expense; o resto é "todos"', () => {
  assert.equal(lerUrl('?tipo=entrada').tipo, 'income')
  assert.equal(lerUrl('?tipo=saida').tipo, 'expense')
  for (const ruim of ['income', 'ENTRADA', 'todos', '', 'xyz']) {
    assert.equal(lerUrl(`?tipo=${ruim}`).tipo, 'all', `tipo=${ruim}`)
  }
})

test('categoria: repetível, só números, sem repetição e na ordem em que vieram', () => {
  assert.deepEqual(lerUrl('?categoria=3&categoria=1&categoria=3').categorias, ['3', '1'])
  assert.deepEqual(lerUrl('?categoria=abc&categoria=2&categoria=-1&categoria=').categorias, ['2'])
})

test('datas: só AAAA-MM-DD de um dia que existe; o resto é ignorado', () => {
  assert.deepEqual([lerUrl('?de=2026-10-01').de, lerUrl('?ate=2026-10-31').ate], ['2026-10-01', '2026-10-31'])
  for (const ruim of ['2026-9-1', 'abc', '2026-02-30', '2026-13-01', '01/10/2026', '2026-10-01T10:00', '']) {
    assert.equal(lerUrl(`?de=${ruim}`).de, null, `de=${ruim}`)
  }
  // 29 de fevereiro só existe em ano bissexto.
  assert.equal(lerUrl('?de=2028-02-29').de, '2028-02-29')
  assert.equal(lerUrl('?de=2027-02-29').de, null)
})

test('intervalo invertido (de depois de ate) é ignorado por inteiro', () => {
  const e = lerUrl('?de=2026-10-31&ate=2026-10-01')
  assert.deepEqual([e.de, e.ate], [null, null])
  // Uma ponta só nunca é inconsistente.
  assert.equal(lerUrl('?de=2026-10-31').de, '2026-10-31')
})

test('busca de texto: lida como veio, com acento e espaço', () => {
  assert.equal(lerUrl('?q=caf%C3%A9%20da%20manh%C3%A3').q, 'café da manhã')
})

test('montar: estado vazio dá busca vazia, sem "?"', () => {
  assert.equal(montarBusca(VAZIO), '')
})

test('montar: só entra o que foi escolhido, em ordem fixa', () => {
  const estado: EstadoUrl = {
    editar: 7,
    q: 'café',
    tipo: 'expense',
    categorias: ['1', '2'],
    de: '2026-10-01',
    ate: '2026-10-31',
  }
  assert.equal(
    montarBusca(estado),
    '?editar=7&q=caf%C3%A9&tipo=saida&categoria=1&categoria=2&de=2026-10-01&ate=2026-10-31'
  )
  assert.equal(montarBusca({ ...VAZIO, tipo: 'income' }), '?tipo=entrada')
  assert.equal(montarBusca({ ...VAZIO, categorias: ['9'] }), '?categoria=9')
})

test('montar: busca só de espaços não vira parâmetro', () => {
  assert.equal(montarBusca({ ...VAZIO, q: '   ' }), '')
})

test('ler o que foi montado devolve o mesmo estado (inclusive com & e acento no texto)', () => {
  const estado: EstadoUrl = {
    editar: 12,
    q: 'pão & queijo = ótimo',
    tipo: 'income',
    categorias: ['4', '10'],
    de: '2026-01-01',
    ate: null,
  }
  assert.deepEqual(lerUrl(montarBusca(estado)), estado)
})

test('intervalo: as duas pontas são inclusivas', () => {
  assert.equal(dentroDoIntervalo('2026-10-01', '2026-10-01', '2026-10-31'), true)
  assert.equal(dentroDoIntervalo('2026-10-31', '2026-10-01', '2026-10-31'), true)
  assert.equal(dentroDoIntervalo('2026-09-30', '2026-10-01', '2026-10-31'), false)
  assert.equal(dentroDoIntervalo('2026-11-01', '2026-10-01', '2026-10-31'), false)
})

test('intervalo: ponta ausente é aberta, e sem pontas tudo passa', () => {
  assert.equal(dentroDoIntervalo('2020-01-01', '2026-10-01', null), false)
  assert.equal(dentroDoIntervalo('2030-01-01', '2026-10-01', null), true)
  assert.equal(dentroDoIntervalo('2030-01-01', null, '2026-10-31'), false)
  assert.equal(dentroDoIntervalo('2020-01-01', null, '2026-10-31'), true)
  assert.equal(dentroDoIntervalo('2020-01-01', null, null), true)
})

test('intervalo: um dia só (de igual a ate) pega só aquele dia', () => {
  assert.equal(dentroDoIntervalo('2026-10-15', '2026-10-15', '2026-10-15'), true)
  assert.equal(dentroDoIntervalo('2026-10-16', '2026-10-15', '2026-10-15'), false)
})

test('intervalo: lê só a data, mesmo que chegue um instante com hora', () => {
  assert.equal(dentroDoIntervalo('2026-10-31T23:30:00Z', '2026-10-01', '2026-10-31'), true)
  assert.equal(dentroDoIntervalo('2026-11-01T00:30:00Z', '2026-10-01', '2026-10-31'), false)
})

test('categorias da URL que não existem são descartadas, na mesma ordem', () => {
  assert.deepEqual(categoriasConhecidas(['3', '99', '1'], [1, 2, 3]), ['3', '1'])
  assert.deepEqual(categoriasConhecidas(['5'], []), [])
  assert.deepEqual(categoriasConhecidas([], [1]), [])
})
