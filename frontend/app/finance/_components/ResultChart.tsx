export interface ResultPoint {
  date: string
  cumulative: number
}

export interface ResultChartProps {
  points: ResultPoint[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const WIDTH = 560
const HEIGHT = 220
const PAD_X = 12
const PAD_Y = 16

/**
 * "Resultado do mês" — saldo acumulado real ao longo das transações
 * datadas (sem comparação com período anterior, não temos esse dado).
 * SVG feito à mão (não recharts) — evita o bug de renderização já
 * encontrado no gráfico de pizza antigo desta mesma página.
 */
function ResultChart({ points }: ResultChartProps) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem transações no período pra montar o gráfico.</p>
  }

  const values = points.map((p) => p.cumulative)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = PAD_X + (points.length > 1 ? i * stepX : innerW / 2)
    const y = PAD_Y + innerH - ((p.cumulative - min) / range) * innerH
    return { x, y, ...p }
  })

  const zeroY = PAD_Y + innerH - ((0 - min) / range) * innerH
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${zeroY} L${coords[0].x.toFixed(1)},${zeroY} Z`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Saldo acumulado ao longo do período">
      <line x1={PAD_X} y1={zeroY} x2={WIDTH - PAD_X} y2={zeroY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
      <path d={areaPath} fill="var(--amber-accent)" opacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--amber-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c) => (
        <circle key={c.date} cx={c.x} cy={c.y} r={4} fill="var(--amber-accent)" className="cursor-pointer">
          <title>{`${formatDate(c.date)} — ${formatCurrency(c.cumulative)} acumulado`}</title>
        </circle>
      ))}
    </svg>
  )
}

export { ResultChart }
