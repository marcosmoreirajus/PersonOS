/**
 * Última conta usada no lançamento manual (issue #22): fica no navegador, por
 * usuário, só para preselecionar o campo. Não é dado do app — se sumir, o campo
 * abre vazio e a pessoa escolhe.
 */

/** O pedaço do `localStorage` que usamos (e que um teste consegue imitar). */
export type Armazenamento = {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
}

const chave = (userId: number) => `personos:ultima-conta:${userId}`

/** `localStorage` pode lançar (janela privada, dados bloqueados): nesse caso, nada de preseleção. */
export function lerUltimaConta(storage: Armazenamento | null, userId: number): number | null {
  try {
    const n = Number(storage?.getItem(chave(userId)))
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function guardarUltimaConta(storage: Armazenamento | null, userId: number, contaId: number): void {
  try {
    storage?.setItem(chave(userId), String(contaId))
  } catch {
    // sem armazenamento a preseleção some; o lançamento não pode falhar por isso
  }
}

/**
 * Conta com que o formulário abre: a última usada, se ainda existe; senão, a
 * única conta do usuário (escolher entre uma só é cerimônia); senão nenhuma.
 */
export function contaInicial(contas: { id: number }[], ultima: number | null): number | null {
  if (ultima != null && contas.some((c) => c.id === ultima)) return ultima
  return contas.length === 1 ? contas[0].id : null
}
