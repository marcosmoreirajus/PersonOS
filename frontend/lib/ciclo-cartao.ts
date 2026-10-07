/**
 * Texto de apoio do cadastro de cartão: em que fatura cai uma compra, a partir
 * dos dias de fechamento e vencimento. Segue a regra do backend
 * (`app/services/faturas.py`): compra até o dia de fechamento, inclusive, entra
 * na fatura que fecha no próprio mês; essa fatura vence no mesmo mês se o dia de
 * vencimento for depois do fechamento, e no mês seguinte se não for.
 */

/** Mantém só dígitos, no máximo 2, e prende o dia em 1..31 (0 e vazio ficam vazios). */
export function limparDia(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 2)
  if (digitos === '' || Number(digitos) === 0) return ''
  return String(Math.min(Number(digitos), 31))
}

/** `null` enquanto os dois dias não estiverem preenchidos e válidos. */
export function fraseDoCiclo(fechamento: string, vencimento: string): string | null {
  const f = Number(fechamento)
  const v = Number(vencimento)
  if (!Number.isInteger(f) || !Number.isInteger(v) || f < 1 || f > 31 || v < 1 || v > 31) return null
  const mes = v > f ? 'do mesmo mês' : 'do mês seguinte'
  return `Compras feitas até o dia ${f} entram na fatura que vence dia ${v} ${mes}.`
}
