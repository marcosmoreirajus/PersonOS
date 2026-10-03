/**
 * O caminho único do frontend até a API.
 *
 * Antes desta módulo, cada tela repetia a URL, o id do usuário e o tratamento
 * de erro — 17 cópias e 6 padrões convivendo, um dos quais deixava uma exclusão
 * falhada "dar certo" na tela. Aqui a resposta é sempre uma: sucesso devolve o
 * conteúdo de `data`, erro vira `ApiError` com a frase que o backend mandou.
 */

/** Base da API. `NEXT_PUBLIC_API_URL` nunca foi setado em lugar nenhum — o
 *  padrão local é o caminho usado em toda máquina de desenvolvimento. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Identidade da pessoa, temporária até o fluxo de autenticação entrar
 *  (ver "Autenticação JWT" no backlog). Fica aqui para ser um ponto só. */
export const CURRENT_USER_ID = 1

export class ApiError extends Error {
  /** Status HTTP. `0` significa que não houve resposta nenhuma — o servidor
   *  está fora do ar, não respondeu dentro do tempo, ou a URL está errada. */
  readonly status: number
  /** Corpo cru da resposta, preservado como veio. Numa validação do Pydantic
   *  (422) é a lista de `loc/msg/type` — foi por isso que ela não vira
   *  string: é o que se olha quando se está depurando. */
  readonly detail: unknown

  constructor(mensagem: string, status: number, detail: unknown) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** O servidor respondeu, mas não no formato que a interface promete: corpo que
 *  não é JSON (backend derrubado devolvendo traceback, página de erro do Next
 *  antes de chegar no backend, proxy no meio do caminho), ou JSON sem a chave
 *  `data`. Separar de `ApiError` importa: aqui a causa está no corpo, não numa
 *  frase que alguém escolheu escrever. */
export class RespostaInvalida extends Error {
  readonly status: number
  readonly url: string
  readonly corpo: string

  constructor(url: string, status: number, corpo: string) {
    super(`O servidor devolveu uma resposta inválida (${status}).`)
    this.name = 'RespostaInvalida'
    this.status = status
    this.url = url
    this.corpo = corpo
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>

export type Initiativa = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Objeto vira JSON com o `Content-Type`. `FormData` passa intacto e SEM
   *  header — o boundary é do navegador e forçar o `Content-Type` quebra o
   *  upload. */
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

/** URL completa. Também serve para o que não é `fetch`: o link de download do
 *  modelo de importação é navegação de browser, não requisição. */
export function apiUrl(caminho: string, query?: Query): string {
  const base = `${API_URL}${caminho}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== null && valor !== undefined) params.append(chave, String(valor))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function requisicao(init: Initiativa = {}): RequestInit {
  const { method = 'GET', body, signal } = init
  const req: RequestInit = { method, signal }
  if (body instanceof FormData) {
    // Só o browser monta o boundary. Não declarar Content-Type aqui.
    req.body = body
  } else if (body !== undefined) {
    req.headers = { 'Content-Type': 'application/json' }
    req.body = JSON.stringify(body)
  }
  return req
}

function mensagemDe(status: number): string {
  if (status === 0) return 'Não foi possível falar com o servidor.'
  if (status === 404) return 'Não encontrado.'
  if (status >= 500) return 'O servidor encontrou um erro.'
  return 'Não foi possível completar a operação.'
}

/** A frase que o backend mandou, se houver.
 *
 *  O contrato de erro tem DUAS chaves e isso não é unificado: `raise
 *  HTTPException` devolve `{"detail": "..."}` e o `return {"error": "..."}, 404`
 *  escrito à mão no `main.py` devolve `{"error": "..."}`. A ordem importa — a
 *  chave `error` é a dos 404 de "não encontrado", que é justamente onde a
 *  exclusão e a edição de um lançamento já apagado caem. */
function extraiMensagem(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null
  const registro = corpo as Record<string, unknown>
  const detail = registro.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const error = registro.error
  if (typeof error === 'string' && error.trim()) return error
  // 422 do Pydantic: `detail` é uma lista de {loc, msg, type}. A primeira
  // offending msg é a parte legível; o resto fica no `detail` cru.
  if (Array.isArray(detail)) {
    const primeira = detail.find((item) => item && typeof item === 'object' && typeof item.msg === 'string')
    if (primeira) return primeira.msg as string
  }
  return null
}

/** Requisição sem julgamento: devolve a `Response` e não lança em `!ok`.
 *
 *  Existe porque a tela "A revisar" devolve a resposta crua para um `resolver`
 *  que decide o que fazer — é o único lugar do app onde o tratamento de erro
 *  é uma decisão de quem chamou, e mexer nisso aqui seria tirar a decisão
 *  dela. */
export async function apiRaw(caminho: string, init: Initiativa = {}): Promise<Response> {
  const url = apiUrl(caminho, init.query)
  let res: Response
  try {
    res = await fetch(url, requisicao(init))
  } catch (erro) {
    throw new ApiError('Não foi possível falar com o servidor.', 0, erro)
  }
  return res
}

/** Requisição que dá `data` ou lança. */
export async function api<T = unknown>(caminho: string, init: Initiativa = {}): Promise<T> {
  const url = apiUrl(caminho, init.query)
  const res = await apiRaw(caminho, init)

  const texto = await res.text().catch(() => '')
  let corpo: unknown = null
  try {
    corpo = texto ? JSON.parse(texto) : null
  } catch {
    throw new RespostaInvalida(url, res.status, texto)
  }

  if (!res.ok) {
    throw new ApiError(extraiMensagem(corpo) ?? mensagemDe(res.status), res.status, corpo)
  }

  // Toda rota de dados do backend responde `{"data": ...}` — as 31, sem
  // exceção. Um 2xx sem essa chave é contrato quebrado, e devolver `undefined`
  // como se fosse `T` é exatamente o "500 virou lista vazia" que esta módulo
  // existe para acabar com.
  if (!corpo || typeof corpo !== 'object' || !('data' in corpo)) {
    throw new RespostaInvalida(url, res.status, texto)
  }

  return (corpo as { data: T }).data
}