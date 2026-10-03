/**
 * Critérios de aceite do caminho único até a API (`lib/api.ts`).
 * Roda com `npm test` (test runner nativo do Node, que executa TypeScript).
 *
 * Não há msw nem undici no projeto, então a rede é substituída à mão: cada
 * teste conta o que foi enviado e devolve a `Response` que quer.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { API_URL, ApiError, RespostaInvalida, api, apiUrl } from './api.ts'

type Chamada = { url: string; init: RequestInit }

const REDE_QUEBRADA = Symbol('rede-quebrada')

/** Roda `corpo` com a rede trocada por uma resposta fixa e devolve a chamada. */
async function comResposta(
  resposta: Response | typeof REDE_QUEBRADA,
  corpo: () => Promise<void>,
): Promise<Chamada> {
  const original = globalThis.fetch
  const registro = {} as Chamada
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    registro.url = String(url)
    registro.init = init
    if (resposta === REDE_QUEBRADA) throw new TypeError('fetch failed')
    return resposta
  }) as unknown as typeof fetch
  try {
    await corpo()
  } finally {
    globalThis.fetch = original
  }
  return registro
}

const responde = (status: number, corpo: unknown) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** O erro que a promise rejeitou. Falha alto se não rejeitou. */
async function rejeita(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (erro) {
    return erro as Error
  }
  throw new Error('era para ter rejeitado, e não rejeitou')
}

test('sucesso devolve o conteúdo de data, não o envelope', async () => {
  await comResposta(responde(200, { data: [{ id: 1 }, { id: 2 }] }), async () => {
    const lancamentos = await api<{ id: number }[]>('/api/transactions/user/1')
    assert.equal(lancamentos.length, 2)
    assert.equal(lancamentos[1].id, 2)
  })
})

test('a query sai montada, não colada na mão', async () => {
  const chamada = await comResposta(responde(200, { data: [] }), async () => {
    await api('/api/series/projection/1', { query: { de: '2026-10-01', ate: '2026-10-31' } })
  })
  assert.equal(chamada.url, `${API_URL}/api/series/projection/1?de=2026-10-01&ate=2026-10-31`)
})

test('valores nulos e indefinidos da query não viram "?de=null"', async () => {
  const chamada = await comResposta(responde(200, { data: [] }), async () => {
    await api('/api/transactions/1', { query: { scope: 'only_this', extra: null, nada: undefined } })
  })
  assert.equal(chamada.url, `${API_URL}/api/transactions/1?scope=only_this`)
})

test('corpo objeto vira JSON com o Content-Type', async () => {
  const chamada = await comResposta(responde(200, { data: { deleted: 3 } }), async () => {
    await api('/api/transactions/bulk', { method: 'POST', body: { ids: [1, 2], action: 'delete' } })
  })
  assert.equal(chamada.init.method, 'POST')
  assert.deepEqual(chamada.init.headers, { 'Content-Type': 'application/json' })
  assert.equal(chamada.init.body, '{"ids":[1,2],"action":"delete"}')
})

test('corpo FormData passa intacto e sem Content-Type — o boundary é do browser', async () => {
  const arquivo = new FormData()
  arquivo.append('arquivo', 'conteudo')
  const chamada = await comResposta(responde(200, { data: {} }), async () => {
    await api('/api/import/preview', { method: 'POST', body: arquivo })
  })
  assert.equal(chamada.init.body, arquivo)
  assert.equal(chamada.init.headers, undefined)
})

test('o erro de negócio do backend vira a frase que ele mandou (chave detail)', async () => {
  await comResposta(responde(400, { detail: 'Já existe uma conta com esse nome.' }), async () => {
    const erro = await rejeita(api('/api/accounts', { method: 'POST', body: {} }))
    assert.ok(erro instanceof ApiError)
    assert.equal(erro.message, 'Já existe uma conta com esse nome.')
    assert.equal(erro.status, 400)
  })
})

test('o 404 escrito à mão no main.py vem na chave error, e é lido também', async () => {
  await comResposta(responde(404, { error: 'Transaction not found' }), async () => {
    const erro = await rejeita(api('/api/transactions/99', { method: 'DELETE' }))
    assert.ok(erro instanceof ApiError)
    assert.equal(erro.message, 'Transaction not found')
    assert.equal(erro.status, 404)
  })
})

test('a validação do Pydantic (422) vira frase, mas o detalhe fica preservado', async () => {
  const detalhe = [{ loc: ['body', 'amount'], msg: 'Field required', type: 'missing' }]
  await comResposta(responde(422, { detail: detalhe }), async () => {
    const erro = await rejeita(api('/api/transactions', { method: 'POST', body: {} }))
    assert.ok(erro instanceof ApiError)
    assert.equal(erro.message, 'Field required')
    assert.deepEqual(erro.detail, { detail: detalhe })
  })
})

test('erro sem frase reconhecível cai na mensagem do status, não em "undefined"', async () => {
  await comResposta(responde(500, {}), async () => {
    const erro = await rejeita(api('/api/dashboard/1'))
    assert.ok(erro instanceof ApiError)
    assert.equal(erro.message, 'O servidor encontrou um erro.')
    assert.equal(erro.status, 500)
  })
})

test('servidor fora do ar é status 0, distinguível de um 500', async () => {
  await comResposta(REDE_QUEBRADA, async () => {
    const erro = await rejeita(api('/api/dashboard/1'))
    assert.ok(erro instanceof ApiError)
    assert.equal(erro.status, 0)
    assert.equal(erro.message, 'Não foi possível falar com o servidor.')
  })
})

test('corpo que não é JSON não vira "lista vazia": diz o que houve', async () => {
  const resposta = new Response('<html>404</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })
  await comResposta(resposta, async () => {
    const erro = await rejeita(api('/api/dashboard/1'))
    assert.ok(erro instanceof RespostaInvalida)
    assert.equal(erro.status, 502)
    assert.match(erro.corpo, /404/)
  })
})

test('2xx sem a chave data é contrato quebrado, não sucesso vazio', async () => {
  await comResposta(responde(200, { geradas: 3 }), async () => {
    const erro = await rejeita(api('/api/series/extend', { method: 'POST', body: {} }))
    assert.ok(erro instanceof RespostaInvalida)
    assert.equal(erro.status, 200)
  })
})

test('cancelar por signal não vira ApiError: o AbortError passa intacto', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new DOMException('cancelado', 'AbortError')
  }) as unknown as typeof fetch
  try {
    const erro = await rejeita(api('/api/transactions/user/1', { signal: new AbortController().signal }))
    assert.ok(!(erro instanceof ApiError))
    assert.equal(erro.name, 'AbortError')
  } finally {
    globalThis.fetch = original
  }
})

test('2xx com corpo vazio (204) é contrato quebrado, não sucesso', async () => {
  await comResposta(new Response(null, { status: 204 }), async () => {
    const erro = await rejeita(api('/api/transactions/1', { method: 'DELETE' }))
    assert.ok(erro instanceof RespostaInvalida)
    assert.equal(erro.status, 204)
  })
})

test('erro sem corpo cai na mensagem do status (404 e 400)', async () => {
  await comResposta(new Response(null, { status: 404 }), async () => {
    assert.equal((await rejeita(api('/api/x'))).message, 'Não encontrado.')
  })
  await comResposta(new Response(null, { status: 400 }), async () => {
    assert.equal((await rejeita(api('/api/x'))).message, 'Não foi possível completar a operação.')
  })
})

test('query aceita boolean e number e ignora null/undefined', () => {
  assert.equal(
    apiUrl('/api/x', { ativo: true, limite: 10, vazio: null, ausente: undefined }),
    `${API_URL}/api/x?ativo=true&limite=10`,
  )
})

test('apiUrl monta a URL do link de download, que não é fetch', () => {
  assert.equal(apiUrl('/api/import/template/csv'), `${API_URL}/api/import/template/csv`)
})
