/**
 * Campo de valor em reais, no formato brasileiro ("1.250,50").
 *
 * A máscara acompanha a digitação: os milhares ganham ponto sozinhos
 * (1234 vira "1.234") e a vírgula começa os centavos (até 2 casas). Ponto
 * digitado é ignorado — quem separa os centavos é a vírgula, como no teclado
 * brasileiro. Aqui só há texto; o número sai de `lerValor`.
 */

/** Reaplica a máscara sobre o que o usuário acabou de digitar ou colar. */
export function formatarValor(texto: string, permitirNegativo = false): string {
  const negativo = permitirNegativo && texto.trimStart().startsWith('-')
  const [parteInteira, ...resto] = texto.replace(/[^\d,]/g, '').split(',')
  const temVirgula = resto.length > 0
  const centavos = resto.join('').slice(0, 2)
  let inteira = parteInteira.replace(/^0+(?=\d)/, '')
  if (inteira === '' && temVirgula) inteira = '0'
  if (inteira === '') return negativo ? '-' : ''
  const agrupada = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (negativo ? '-' : '') + agrupada + (temVirgula ? ',' + centavos : '')
}

/**
 * O texto do campo como número. Vazio vale 0; o que não é número devolve
 * `null` (a tela pede de novo).
 */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return 0
  if (!/^-?[\d.]*,?\d*$/.test(limpo) || !/\d/.test(limpo)) return null
  const valor = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

/** Um valor guardado como o campo o mostra ao editar: 1250.5 vira "1.250,50"; 0 e ausente viram vazio. */
export function valorParaCampo(valor: number | null | undefined): string {
  if (!valor) return ''
  return formatarValor(valor.toFixed(2).replace('.', ','), true)
}
