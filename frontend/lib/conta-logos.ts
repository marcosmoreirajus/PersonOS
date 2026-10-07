import { CreditCard, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'

/**
 * Coleção fechada de logos de conta: o usuário escolhe um item pronto, não
 * envia imagem. A conta guarda um de dois textos, e o backend valida os dois
 * em `backend/app/conta_logos.py` (`conta-logos.test.ts` confere que as listas
 * batem):
 *   catalogo:<chave>      instituição financeira ou bandeira de cartão
 *   icone:<icone>:<cor>   ícone personalizado sobre uma cor da paleta
 * Instituições são siglas sobre a cor da marca, sem logotipo real: nada de
 * arquivo de imagem para versionar nem direito de marca em jogo.
 */
export const PREFIXO_LOGO = 'catalogo:'
export const PREFIXO_ICONE = 'icone:'

export type Instituicao = { chave: string; nome: string; sigla: string; fundo: string; texto: string }

export const INSTITUICOES: Instituicao[] = [
  { chave: 'banco-do-brasil', nome: 'Banco do Brasil', sigla: 'BB', fundo: '#fae128', texto: '#003da5' },
  { chave: 'caixa', nome: 'Caixa', sigla: 'CX', fundo: '#0070af', texto: '#ffffff' },
  { chave: 'itau', nome: 'Itaú', sigla: 'itaú', fundo: '#ec7000', texto: '#ffffff' },
  { chave: 'bradesco', nome: 'Bradesco', sigla: 'Br', fundo: '#cc092f', texto: '#ffffff' },
  { chave: 'nubank', nome: 'Nubank', sigla: 'nu', fundo: '#820ad1', texto: '#ffffff' },
  { chave: 'santander', nome: 'Santander', sigla: 'Sa', fundo: '#ec0000', texto: '#ffffff' },
  { chave: 'inter', nome: 'Banco Inter', sigla: 'In', fundo: '#ff7a00', texto: '#ffffff' },
  { chave: 'btg', nome: 'BTG Pactual', sigla: 'btg', fundo: '#001e62', texto: '#ffffff' },
  { chave: 'c6', nome: 'C6 Bank', sigla: 'C6', fundo: '#1a1a1a', texto: '#ffffff' },
  { chave: 'xp', nome: 'XP', sigla: 'XP', fundo: '#111111', texto: '#ffd100' },
  { chave: 'mercado-pago', nome: 'Mercado Pago', sigla: 'MP', fundo: '#009ee3', texto: '#ffffff' },
  { chave: 'picpay', nome: 'PicPay', sigla: 'PP', fundo: '#21c25e', texto: '#ffffff' },
  { chave: 'sicredi', nome: 'Sicredi', sigla: 'Sc', fundo: '#3fa535', texto: '#ffffff' },
  { chave: 'sicoob', nome: 'Sicoob', sigla: 'So', fundo: '#003641', texto: '#ffffff' },
  { chave: 'neon', nome: 'Neon', sigla: 'Ne', fundo: '#00e5e5', texto: '#00363a' },
  { chave: 'will', nome: 'Will Bank', sigla: 'Wi', fundo: '#ffd400', texto: '#1a1a1a' },
  { chave: 'pagbank', nome: 'PagBank', sigla: 'PB', fundo: '#41b883', texto: '#ffffff' },
  { chave: 'original', nome: 'Banco Original', sigla: 'Or', fundo: '#1ba05e', texto: '#ffffff' },
  { chave: 'safra', nome: 'Safra', sigla: 'Sf', fundo: '#0b2a4a', texto: '#ffffff' },
  { chave: 'next', nome: 'Next', sigla: 'Nx', fundo: '#00ff5f', texto: '#0b2a1a' },
  { chave: 'banrisul', nome: 'Banrisul', sigla: 'Ba', fundo: '#005baa', texto: '#ffffff' },
  { chave: 'stone', nome: 'Stone', sigla: 'St', fundo: '#00a868', texto: '#ffffff' },
]

/** Bandeiras de cartão (aparecem na escolha de ícone do cartão). Mesmo formato das instituições. */
export const BANDEIRAS: Instituicao[] = [
  { chave: 'visa', nome: 'Visa', sigla: 'VISA', fundo: '#1a1f71', texto: '#ffffff' },
  { chave: 'mastercard', nome: 'Mastercard', sigla: 'MC', fundo: '#f2f2f2', texto: '#eb001b' },
  { chave: 'elo', nome: 'Elo', sigla: 'elo', fundo: '#111111', texto: '#ffcb05' },
  { chave: 'amex', nome: 'American Express', sigla: 'AMEX', fundo: '#016fd0', texto: '#ffffff' },
  { chave: 'hipercard', nome: 'Hipercard', sigla: 'Hiper', fundo: '#b3131b', texto: '#ffffff' },
  { chave: 'diners', nome: 'Diners Club', sigla: 'DC', fundo: '#0079be', texto: '#ffffff' },
]

export type IconePersonalizado = { chave: string; nome: string; icone: LucideIcon }

export const ICONES: IconePersonalizado[] = [
  { chave: 'banco', nome: 'Banco', icone: Landmark },
  { chave: 'carteira', nome: 'Carteira', icone: Wallet },
  { chave: 'cofrinho', nome: 'Cofrinho', icone: PiggyBank },
  { chave: 'cartao', nome: 'Cartão', icone: CreditCard },
]

/** Paleta dos ícones personalizados (hex sem `#`), na ordem em que aparece. */
export const CORES: string[] = [
  'f1f3f2', 'd6d6d6', 'ffe600', 'ff0000', '0066ff', '00e664',
  'ffd8b0', 'ffbf70', 'ffa02e', 'e87500', 'ff9eb0', 'ff6b81',
  'ff3350', 'cc001f', 'ff8f7d', 'ff5a3c', 'b8e986', '7ed321',
  '5cb000', '417505', '8fffe0', '4df2cc', '10d9ac', '00b08a',
  '9fd8ff', '4aa8ff', '1f5fbf', '0a2a66', 'd5b8ff', 'a066ff',
  '7a28e0', '4b1587', '8b5a2b', '333333',
]

/** Como o selo de uma conta se desenha: sigla ou ícone, sobre um fundo. */
export type LogoDesenhado = { nome: string; fundo: string; texto: string } & (
  | { sigla: string; icone?: undefined }
  | { icone: LucideIcon; sigla?: undefined }
)

/** Preto ou branco, o que ler melhor sobre o fundo (luminância relativa simples). */
export function textoSobre(fundoHex: string): string {
  const h = fundoHex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1a1a1a' : '#ffffff'
}

export function valorInstituicao(chave: string): string {
  return PREFIXO_LOGO + chave
}

export function valorIcone(icone: string, cor: string): string {
  return `${PREFIXO_ICONE}${icone}:${cor}`
}

export function logoDaConta(valor: string | null | undefined): LogoDesenhado | null {
  if (!valor) return null
  if (valor.startsWith(PREFIXO_LOGO)) {
    const chave = valor.slice(PREFIXO_LOGO.length)
    const i = INSTITUICOES.find((x) => x.chave === chave) ?? BANDEIRAS.find((x) => x.chave === chave)
    return i ? { nome: i.nome, fundo: i.fundo, texto: i.texto, sigla: i.sigla } : null
  }
  if (valor.startsWith(PREFIXO_ICONE)) {
    const [chave, cor] = valor.slice(PREFIXO_ICONE.length).split(':')
    const ic = ICONES.find((x) => x.chave === chave)
    if (!ic || !CORES.includes(cor)) return null
    const fundo = '#' + cor
    return { nome: ic.nome, fundo, texto: textoSobre(fundo), icone: ic.icone }
  }
  return null
}
