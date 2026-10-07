/**
 * Saldo digitado no diálogo de conta, em formato brasileiro ("1.250,00"):
 * mesmas regras do campo de valor do app (`lib/valor.ts`).
 */
export { lerValor as lerSaldo, valorParaCampo as saldoParaCampo } from './valor.ts'
