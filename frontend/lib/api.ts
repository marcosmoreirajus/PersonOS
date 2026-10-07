/**
 * O caminho único do frontend até a API.
 *
 * Antes deste módulo, cada tela repetia a URL, o id do usuário e o tratamento
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
   *  está fora do ar, a conexão caiu, ou a URL está errada. */
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

export type ApiOperationToast = {
  id: string
  status: 'loading' | 'success' | 'error' | 'dismiss'
  title: string
  description?: string
}

type ApiOperationLabels = {
  loading: string
  success: string
  error: string
}

const operationToastListeners = new Set<(toast: ApiOperationToast) => void>()
let queuedOperationToasts: ApiOperationToast[] = []
let operationSeed = 0

/** Permite que a interface global acompanhe operações da API sem acoplar o
 *  cliente HTTP a componentes React. Eventos anteriores à montagem da pilha
 *  ficam em fila para não perder operações disparadas na montagem de uma tela. */
export function subscribeToApiOperationToasts(listener: (toast: ApiOperationToast) => void) {
  operationToastListeners.add(listener)
  queuedOperationToasts.forEach(listener)
  queuedOperationToasts = []
  return () => {
    operationToastListeners.delete(listener)
  }
}

function publicarToastOperacao(toast: ApiOperationToast) {
  // api() também é exercitada em Node nos testes; notificações são exclusivas
  // do navegador e nunca alteram o contrato do cliente HTTP.
  if (typeof window === 'undefined') return
  if (operationToastListeners.size === 0) {
    queuedOperationToasts.push(toast)
    return
  }
  operationToastListeners.forEach((listener) => listener(toast))
}

function rotulosDaOperacao(caminho: string, metodo: string, body: unknown): ApiOperationLabels {
  const rota = caminho.split('?')[0].toLowerCase()
  const acaoEmLote = body && typeof body === 'object' && 'action' in body
    ? String((body as { action: unknown }).action)
    : ''

  if (rota.includes('/import/preview')) {
    return { loading: 'Analisando arquivo...', success: 'Arquivo analisado', error: 'Não foi possível analisar o arquivo.' }
  }
  if (rota.includes('/import/confirm') || rota.includes('/import/commit')) {
    return { loading: 'Importando lançamentos...', success: 'Importação concluída', error: 'Não foi possível concluir a importação.' }
  }
  if (rota.includes('/series/extend')) {
    return { loading: 'Atualizando lançamentos recorrentes...', success: 'Lançamentos recorrentes atualizados', error: 'Não foi possível atualizar os lançamentos recorrentes.' }
  }
  if (rota.includes('/reconcile')) {
    return { loading: 'Conciliando lançamento...', success: 'Lançamento conciliado', error: 'Não foi possível conciliar o lançamento.' }
  }
  if (/\/publish|\/publicar|\/publications/.test(rota)) {
    return { loading: 'Publicando item...', success: 'Item publicado', error: 'Não foi possível publicar o item.' }
  }

  const recurso = rota.includes('/transactions')
    ? { singular: 'lançamento', plural: 'lançamentos', objeto: 'o lançamento', contexto: 'no lançamento', salvo: 'Lançamento salvo', excluido: 'Lançamento excluído' }
    : rota.includes('/accounts')
      ? { singular: 'conta', plural: 'contas', objeto: 'a conta', contexto: 'na conta', salvo: 'Conta salva', excluido: 'Conta excluída' }
      : rota.includes('/cards')
        ? { singular: 'cartão', plural: 'cartões', objeto: 'o cartão', contexto: 'no cartão', salvo: 'Cartão salvo', excluido: 'Cartão excluído' }
        : rota.includes('/preferences')
          ? { singular: 'preferência', plural: 'preferências', objeto: 'as preferências', contexto: 'nas preferências', salvo: 'Preferências salvas', excluido: 'Preferências atualizadas' }
          : rota.includes('/business')
            ? { singular: 'dados da seção', plural: 'dados da seção', objeto: 'os dados da seção', contexto: 'nos dados da seção', salvo: 'Dados da seção salvos', excluido: 'Dados da seção excluídos' }
            : { singular: 'item', plural: 'itens', objeto: 'o item', contexto: 'no item', salvo: 'Item salvo', excluido: 'Item excluído' }

  const emLote = rota.endsWith('/bulk')
  const alvo = emLote ? recurso.plural : recurso.objeto
  const contexto = emLote ? 'nos lançamentos' : recurso.contexto

  if (metodo === 'DELETE' || (emLote && acaoEmLote === 'delete')) {
    return {
      loading: `Excluindo ${alvo}...`,
      success: emLote ? 'Lançamentos excluídos' : recurso.excluido,
      error: `Não foi possível excluir ${alvo}.`,
    }
  }
  if (metodo === 'POST' && !emLote) {
    return {
      loading: `Salvando ${recurso.singular}...`,
      success: recurso.salvo,
      error: `Não foi possível salvar ${alvo}.`,
    }
  }

  return {
    loading: `Salvando alterações ${contexto}...`,
    success: 'Alterações salvas',
    error: `Não foi possível salvar as alterações ${contexto}.`,
  }
}

function novoIdDeOperacao() {
  return `api-operation-${Date.now()}-${operationSeed++}`
}

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

/** Faz o `fetch`. Falha de rede vira `ApiError` de status 0; cancelamento por
 *  `signal` (`AbortError`) passa intacto, porque cancelar não é erro do
 *  servidor e quem cancelou precisa reconhecê-lo. */
async function buscar(url: string, init: Initiativa): Promise<Response> {
  try {
    return await fetch(url, requisicao(init))
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    throw new ApiError('Não foi possível falar com o servidor.', 0, erro)
  }
}

/** Requisição que dá `data` ou lança. Escritas também publicam o ciclo de
 *  feedback (carregamento/sucesso/erro) consumido pela pilha global de toasts. */
export async function api<T = unknown>(caminho: string, init: Initiativa = {}): Promise<T> {
  const url = apiUrl(caminho, init.query)
  const metodo = init.method ?? 'GET'
  const rotulos = metodo === 'GET' ? null : rotulosDaOperacao(caminho, metodo, init.body)
  const operationId = rotulos ? novoIdDeOperacao() : null

  if (rotulos && operationId) {
    publicarToastOperacao({ id: operationId, status: 'loading', title: rotulos.loading })
  }

  try {
    const res = await buscar(url, init)
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
    // como se fosse `T` é exatamente o "500 virou lista vazia" que este módulo
    // existe para acabar com.
    if (!corpo || typeof corpo !== 'object' || !('data' in corpo)) {
      throw new RespostaInvalida(url, res.status, texto)
    }

    if (rotulos && operationId) {
      publicarToastOperacao({ id: operationId, status: 'success', title: rotulos.success })
    }
    return (corpo as { data: T }).data
  } catch (erro) {
    if (rotulos && operationId) {
      const cancelada = erro instanceof DOMException && erro.name === 'AbortError'
      publicarToastOperacao({
        id: operationId,
        status: cancelada ? 'dismiss' : 'error',
        title: cancelada ? rotulos.loading : rotulos.error,
        ...(cancelada || !(erro instanceof Error) ? {} : { description: erro.message }),
      })
    }
    throw erro
  }
}
