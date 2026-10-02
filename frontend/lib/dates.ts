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
