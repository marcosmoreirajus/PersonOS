/**
 * Data no formato `AAAA-MM-DD` pelo relógio local.
 *
 * `toISOString()` converte para UTC antes: no Brasil (UTC-3), depois das 21h
 * ele já devolve o dia seguinte, e o que vence hoje vira "em atraso".
 */
export function isoLocal(d: Date = new Date()): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Hoje (`AAAA-MM-DD`) pelo relógio local. */
export function hojeLocal(): string {
  return isoLocal()
}

/**
 * Data de calendário (`AAAA-MM-DD`) em `DD/MM/AAAA`.
 *
 * Lê só os 10 primeiros caracteres e fixa meia-noite UTC formatando em UTC:
 * assim o dia nunca anda, nem no Brasil (UTC-3), nem se chegar um instante
 * com hora no lugar da data.
 */
export function formatDateBR(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
