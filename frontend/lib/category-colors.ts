/**
 * Cor de categoria por ranking de gasto no período (não mais fixa por
 * categoria) — decisão de 2026-09-17: o âmbar marca sempre a categoria de
 * maior despesa, não uma categoria específica. Chamar com a lista já
 * ordenada por valor decrescente.
 */
const RANK_COLORS = ['var(--amber-accent)', 'var(--sage)', 'var(--dusty-blue)', 'var(--terracotta)']
const NEUTRAL_COLOR = 'var(--muted-foreground)'

export function categoryColorByRank(rank: number): string {
  return RANK_COLORS[rank] ?? NEUTRAL_COLOR
}
