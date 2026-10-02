/**
 * Critérios de aceite da issue #2 sobre a derivação dos avisos do sino.
 * Roda com `npm test` (test runner nativo do Node, que executa TypeScript).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PREFERENCIAS_PADRAO,
  contarNaoVistos,
  derivarAvisos,
  paresDe,
  tituloAVencer,
  tituloEmAtraso,
  opcaoJanela,
  type TipoAviso,
  type LancamentoAviso,
  type Preferencias,
} from './avisos.ts'

const HOJE = '2026-10-02'

let proximo = 0
function lanc(campos: Partial<LancamentoAviso>): LancamentoAviso {
  proximo += 1
  return { id: proximo, type: 'expense', amount: 10, due_date: HOJE, settled_at: null, ...campos }
}

const prefs = (mudancas: Partial<Preferencias> = {}): Preferencias => ({ ...PREFERENCIAS_PADRAO, ...mudancas })
const ids = (avisos: ReturnType<typeof derivarAvisos>, tipo: TipoAviso) => avisos.find((a) => a.tipo === tipo)?.ids ?? []

test('sem preferência: em atraso e a vencer com janela de 7 dias, até hoje + 7', () => {
  const atrasado = lanc({ due_date: '2026-10-01' })
  const hoje = lanc({ due_date: HOJE })
  const limite = lanc({ due_date: '2026-10-09' })
  const fora = lanc({ due_date: '2026-10-10' })
  const pago = lanc({ due_date: '2026-09-30', settled_at: '2026-09-30' })
  const avisos = derivarAvisos([atrasado, hoje, limite, fora, pago], prefs(), HOJE)

  assert.deepEqual(avisos.map((a) => a.tipo), ['em_atraso', 'a_vencer'])
  assert.deepEqual(ids(avisos, 'em_atraso'), [atrasado.id])
  assert.deepEqual(ids(avisos, 'a_vencer'), [hoje.id, limite.id])
})

test('não existe aviso "sem categoria": é da fila "A revisar"', () => {
  const avisos = derivarAvisos([lanc({ due_date: '2026-11-01' })], prefs(), HOJE)
  assert.equal(avisos.length, 0)
})

test('desligar "a vencer" o remove do sino e do número; religar traz de volta', () => {
  const lista = [lanc({ due_date: '2026-10-01' }), lanc({ due_date: '2026-10-03' })]
  const desligado = derivarAvisos(lista, prefs({ a_vencer: false }), HOJE)
  assert.deepEqual(desligado.map((a) => a.tipo), ['em_atraso'])
  assert.equal(contarNaoVistos(desligado, []), 1)
  assert.equal(contarNaoVistos(derivarAvisos(lista, prefs(), HOJE), []), 2)
})

test('janela 0 é só hoje; janela 1 é hoje e amanhã', () => {
  const hoje = lanc({ due_date: HOJE })
  const amanha = lanc({ due_date: '2026-10-03' })
  const depois = lanc({ due_date: '2026-10-04' })
  const lista = [hoje, amanha, depois]
  assert.deepEqual(ids(derivarAvisos(lista, prefs({ janela_a_vencer: 0 }), HOJE), 'a_vencer'), [hoje.id])
  assert.deepEqual(ids(derivarAvisos(lista, prefs({ janela_a_vencer: 1 }), HOJE), 'a_vencer'), [hoje.id, amanha.id])
})

test('com 5 em atraso e nenhum visto, o número é 5 (conta lançamentos, não tipos)', () => {
  const lista = Array.from({ length: 5 }, (_, i) => lanc({ due_date: `2026-09-2${i}` }))
  assert.equal(contarNaoVistos(derivarAvisos(lista, prefs(), HOJE), []), 5)
})

test('marcar como visto zera o número; a lista continua', () => {
  const avisos = derivarAvisos([lanc({ due_date: '2026-10-01' }), lanc({ due_date: HOJE })], prefs(), HOJE)
  const visto = paresDe(avisos)
  assert.equal(contarNaoVistos(avisos, visto), 0)
  assert.equal(avisos.length, 2)
})

test('depois do visto, passar de "a vencer" para "em atraso" volta o número a 1', () => {
  const conta = lanc({ due_date: HOJE })
  const visto = paresDe(derivarAvisos([conta], prefs(), HOJE))
  const amanha = derivarAvisos([conta], prefs(), '2026-10-03')
  assert.equal(contarNaoVistos(amanha, visto), 1)
})

test('depois do visto, editar o valor de um lançamento listado não altera o número', () => {
  const conta = lanc({ due_date: '2026-10-01', amount: 100 })
  const visto = paresDe(derivarAvisos([conta], prefs(), HOJE))
  const editado = derivarAvisos([{ ...conta, amount: 150 }], prefs(), HOJE)
  assert.equal(contarNaoVistos(editado, visto), 0)
})

test('depois do visto, ampliar a janela de 7 para 15 conta os que entraram', () => {
  const perto = lanc({ due_date: '2026-10-05' })
  const longe1 = lanc({ due_date: '2026-10-12' })
  const longe2 = lanc({ due_date: '2026-10-17' })
  const lista = [perto, longe1, longe2]
  const visto = paresDe(derivarAvisos(lista, prefs(), HOJE))
  assert.equal(contarNaoVistos(derivarAvisos(lista, prefs({ janela_a_vencer: 15 }), HOJE), visto), 2)
})

test('somas separadas por sentido: a pagar e a receber', () => {
  const avisos = derivarAvisos(
    [lanc({ due_date: '2026-10-01', amount: 30 }), lanc({ due_date: '2026-10-01', amount: 50, type: 'income' })],
    prefs(),
    HOJE
  )
  assert.equal(avisos[0].aPagar, 30)
  assert.equal(avisos[0].aReceber, 50)
})

test('título do "a vencer" reflete a janela', () => {
  assert.equal(tituloAVencer(1, 0), '1 vence hoje')
  assert.equal(tituloAVencer(2, 0), '2 vencem hoje')
  assert.equal(tituloAVencer(2, 1), '2 vencem até amanhã')
  assert.equal(tituloAVencer(1, 3), '1 vence nos próximos 3 dias')
  assert.equal(tituloAVencer(4, 15), '4 vencem nos próximos 15 dias')
  assert.equal(tituloEmAtraso(1), '1 lançamento em atraso')
  assert.equal(tituloEmAtraso(5), '5 lançamentos em atraso')
})

test('opções do seletor de janela', () => {
  assert.equal(opcaoJanela(0), 'Só hoje')
  assert.equal(opcaoJanela(1), 'Hoje e amanhã')
  assert.equal(opcaoJanela(7), 'Hoje e os próximos 7 dias')
})
