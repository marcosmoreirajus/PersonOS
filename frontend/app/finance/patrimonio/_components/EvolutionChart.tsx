export interface EvolutionPoint {
  month: string
  total: number
}

export interface EvolutionChartProps {
  points: EvolutionPoint[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

const WIDTH = 560
const HEIGHT = 180
const PAD_X = 12
const PAD_Y = 12

/**
 * "Evolução Patrimonial" — Patrimônio é P&B (decisão de 14/09: sóbrio,
 * sem cor própria), diferente do acento âmbar usado no "Resultado do mês"
 * da Visão Geral. Mesma técnica de SVG à mão (evita o bug do recharts).
 */
function EvolutionChart({ points }: EvolutionChartProps) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico disponível.</p>
  }

  const values = points.map((p) => p.total)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = PAD_X + (points.length > 1 ? i * stepX : innerW / 2)
    const y = PAD_Y + innerH - ((p.total - min) / range) * innerH
    return { x, y, ...p }
  })

  const baseY = PAD_Y + innerH
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Evolução do patrimônio ao longo dos últimos meses">
      <path d={areaPath} fill="var(--foreground)" opacity={0.06} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c) => (
        <circle key={c.month} cx={c.x} cy={c.y} r={3.5} fill="var(--foreground)" className="cursor-pointer">
          <title>{`${formatMonth(c.month)} — ${formatCurrency(c.total)}`}</title>
        </circle>
      ))}
    </svg>
  )
}

export { EvolutionChart, formatMonth }
