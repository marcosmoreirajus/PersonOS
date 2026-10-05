/**
 * Saldo digitado no diálogo de conta, em formato brasileiro ("1.250,00").
 * Vazio vale 0; texto que não é número devolve `null` (a tela pede de novo).
 */
export function lerSaldo(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return 0
  if (!/^-?[\d.]*,?\d*$/.test(limpo) || !/\d/.test(limpo)) return null
  const valor = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

/** O saldo de uma conta como o campo do diálogo mostra ao editar: 1250.5 vira "1250,50"; 0 vira vazio. */
export function saldoParaCampo(valor: number | undefined): string {
  if (!valor) return ''
  return valor.toFixed(2).replace('.', ',')
}
