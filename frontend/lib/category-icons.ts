import {
  Briefcase,
  Car,
  Clapperboard,
  CreditCard,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  Plane,
  Plug,
  Repeat,
  Scissors,
  Shapes,
  ShoppingBag,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * Ícone de categoria — monocromático, traço fino, herdando `currentColor`.
 *
 * Substitui os emojis coloridos que vinham de `categories.json` (decisão de
 * 2026-09-22): emoji ao lado de ícone de traço são duas linguagens visuais no
 * mesmo lugar, e a cor do emoji compete com a cor por ranking dos gráficos.
 * A cor da categoria, quando existir, é aplicada por fora — o ícone nunca
 * traz cor própria.
 *
 * O mapa é explícito de propósito: `import * as icons from 'lucide-react'`
 * arrastaria a biblioteca inteira pro bundle do client (ver o padrão já
 * registrado sobre import namespace em módulo compartilhado).
 */
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  house: House,
  shapes: Shapes,
  landmark: Landmark,
  plug: Plug,
  repeat: Repeat,
  'graduation-cap': GraduationCap,
  'shopping-bag': ShoppingBag,
  scissors: Scissors,
  'paw-print': PawPrint,
  plane: Plane,
  wallet: Wallet,
  briefcase: Briefcase,
  'credit-card': CreditCard,
}

/** Fallback para categoria sem ícone definido — e para o balde "Sem categoria". */
const FALLBACK = Shapes

export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return FALLBACK
  return ICONS[name] ?? FALLBACK
}
