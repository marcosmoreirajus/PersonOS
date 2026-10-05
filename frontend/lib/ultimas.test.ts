import test from 'node:test'
import assert from 'node:assert/strict'

import { agruparPorDia, rotuloDoDia } from './ultimas.ts'

test('o dia de hoje e o de ontem têm nome; os outros mostram a data', () => {
  assert.equal(rotuloDoDia('2026-10-07', '2026-10-07'), 'Hoje')
  assert.equal(rotuloDoDia('2026-10-06', '2026-10-07'), 'Ontem')
  assert.equal(rotuloDoDia('2026-10-05', '2026-10-07'), '05/10/2026')
})

test('ontem vale também na virada de mês e de ano', () => {
  assert.equal(rotuloDoDia('2026-09-30', '2026-10-01'), 'Ontem')
  assert.equal(rotuloDoDia('2025-12-31', '2026-01-01'), 'Ontem')
})

test('dia futuro (ou data torta) mostra a data, nunca "Hoje"', () => {
  assert.equal(rotuloDoDia('2026-10-08', '2026-10-07'), '08/10/2026')
})

test('agrupa por dia mantendo a ordem em que os itens chegaram', () => {
  const itens = [
    { id: 1, day: '2026-10-07' },
    { id: 2, day: '2026-10-07' },
    { id: 3, day: '2026-10-06' },
    { id: 4, day: '2026-10-02' },
  ]
  const grupos = agruparPorDia(itens, '2026-10-07')
  assert.deepEqual(
    grupos.map((g) => [g.dia, g.rotulo, g.itens.map((i) => i.id)]),
    [
      ['2026-10-07', 'Hoje', [1, 2]],
      ['2026-10-06', 'Ontem', [3]],
      ['2026-10-02', '02/10/2026', [4]],
    ],
  )
})

test('sem itens, sem grupos', () => {
  assert.deepEqual(agruparPorDia([], '2026-10-07'), [])
})
