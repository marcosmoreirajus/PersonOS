/**
 * Tendência de Relatórios (issue #18) — lógica pura, sem React.
 *
 * Os pontos (rótulo, receita, despesa, resultado) e a granularidade vêm
 * prontos da API (`app/services/relatorios_tendencia.py`); só a escala do
 * eixo do gráfico mora aqui.
 *
 * Sem imports de alias (`@/`): este arquivo roda direto no Node nos testes.
 */

export type PontoTendencia = {
  chave: string
  rotulo: string
  de: string
  ate: string
  receita: number
  despesa: number
  resultado: number
}

/** Sem lançamento nenhum no período: o bloco mostra o estado vazio. */
export function semMovimento(pontos: Pick<PontoTendencia, 'receita' | 'despesa'>[]): boolean {
  return pontos.every((p) => p.receita === 0 && p.despesa === 0)
}

/** Passo "redondo" (1, 2, 2,5, 5 × 10^n) que cabe `alvo` vezes no intervalo. */
function passoRedondo(intervalo: number, alvo: number): number {
  const bruto = intervalo / alvo
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  for (const f of [1, 2, 2.5, 5, 10]) {
    if (f * potencia >= bruto) return f * potencia
  }
  return 10 * potencia
}

export type EscalaDoEixo = { min: number; max: number; marcas: number[] }

/**
 * Eixo vertical que cobre receita, despesa e resultado, sempre com o zero,
 * de passo redondo (as barras partem do zero e o resultado pode ficar abaixo).
 */
export function escalaDoEixo(pontos: Pick<PontoTendencia, 'receita' | 'despesa' | 'resultado'>[]): EscalaDoEixo {
  const valores = pontos.flatMap((p) => [p.receita, p.despesa, p.resultado])
  const topo = Math.max(0, ...valores)
  const fundo = Math.min(0, ...valores)
  if (topo === 0 && fundo === 0) return { min: 0, max: 1, marcas: [0, 1] }
  const passo = passoRedondo(topo - fundo, 4)
  const min = Math.floor(fundo / passo) * passo
  const max = Math.ceil(topo / passo) * passo
  const marcas: number[] = []
  for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Math.round(v * 100) / 100)
  return { min, max, marcas }
}
