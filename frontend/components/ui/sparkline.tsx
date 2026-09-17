export interface SparklineProps {
  points: number[]
  width?: number
  height?: number
  className?: string
}

/**
 * Linha simples de tendência a partir de uma série de pontos reais — sem
 * comparação com período anterior (não inventa dado histórico que não existe).
 */
function Sparkline({ points, width = 240, height = 56, className }: SparklineProps) {
  if (points.length === 0) return null

  const min = Math.min(...points, 0)
  const max = Math.max(...points, 0)
  const range = max - min || 1
  const stepX = points.length > 1 ? width / (points.length - 1) : 0

  const coords = points.map((v, i) => {
    const x = points.length > 1 ? i * stepX : width / 2
    const y = height - ((v - min) / range) * height
    return [x, y] as const
  })

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`
  const [lastX, lastY] = coords[coords.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Evolução ao longo do período"
    >
      <path d={areaPath} fill="currentColor" opacity={0.08} stroke="none" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill="currentColor" />
    </svg>
  )
}

export { Sparkline }
