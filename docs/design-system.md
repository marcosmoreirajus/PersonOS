# PersonOS — Design System

Sistema de design minimalista, preto & branco, usado em todas as telas do
PersonOS. Consistente com o WikiOS (projeto irmão do mesmo usuário): mesma
stack (shadcn/ui + Base UI + Tailwind v4), mesmo preset (`base-nova`), mesmo
tema neutro e mesmo `--radius` alto.

Escopo deste documento: apenas o sistema de design e os componentes
reutilizáveis em `frontend/components/ui/`. Páginas de negócio (Founder,
Direção, Validação, Caixa) e o backend não fazem parte deste trabalho.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind v4** — CSS-first config (sem `tailwind.config.ts`; tema definido
  em `@theme` dentro do CSS)
- **shadcn/ui**, style `base-nova`, base color `neutral`, CSS variables
  ligadas — sobre **Base UI** (`@base-ui/react`) em vez de Radix
- **lucide-react** para ícones
- `clsx` + `tailwind-merge` via o helper `cn()`

## Paleta de cores

Zero cor saturada — toda a paleta é `oklch` com chroma `0` (cinza puro),
exceto `--destructive` (único token semântico não-neutro, reservado para
estados de erro/exclusão — não é uma cor de destaque de marca).

Definida em `frontend/styles/design-tokens.css`, importado por
`frontend/app/globals.css`. Segue o padrão de CSS variables do shadcn/ui:

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` (branco) | `oklch(0.145 0 0)` (quase preto) | fundo da página |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | texto principal |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | fundo de cards |
| `--muted` / `--muted-foreground` | cinza claro / cinza médio | cinza escuro / cinza claro | texto secundário, placeholders |
| `--accent` / `--accent-foreground` | cinza bem claro | cinza escuro | hover de itens (sidebar, menus) |
| `--secondary` / `--secondary-foreground` | cinza claro | cinza escuro | badges, estado ativo |
| `--border` / `--input` | cinza claro | branco 10% opacidade | bordas, contornos de input |
| `--sidebar*` | variação de `--background`/`--accent` | idem | tokens dedicados da sidebar |
| `--destructive` | `oklch(0.577 0.245 27.325)` (vermelho) | `oklch(0.704 0.191 22.216)` | única cor não-neutra, erro/exclusão |

**Dark mode**: ativa via classe `.dark` na raiz do documento (padrão
shadcn/ui `@custom-variant dark (&:is(.dark *))`), não por
`prefers-color-scheme`. Basta adicionar/remover `className="dark"` no
`<html>` — nenhum componente precisa de lógica própria de tema.

## Radius

`--radius: 0.75rem`, com uma escala derivada em `@theme`:

```
--radius-sm:  calc(var(--radius) * 0.6)   /* 0.45rem */
--radius-md:  calc(var(--radius) * 0.8)   /* 0.6rem  */
--radius-lg:  var(--radius)               /* 0.75rem */
--radius-xl:  calc(var(--radius) * 1.4)   /* 1.05rem */
--radius-2xl: calc(var(--radius) * 1.8)   /* 1.35rem */
```

Todos os componentes usam `rounded-lg`/`rounded-xl` (nunca cantos retos) —
inclusive itens de sidebar, cards e botões do toggle de visualização.

## Fonte

**Inter**, aplicada via `--font-sans` (utilitário `font-sans` no `<html>`).

Como o `app/layout.tsx` pode estar sendo editado em paralelo por outro
agente, a fonte foi aplicada em duas camadas para não depender de editar
esse arquivo agora:

1. **Hoje (já funciona)**: `frontend/app/globals.css` importa a Inter
   diretamente do Google Fonts:
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
   ```
2. **Migração recomendada** (quando `layout.tsx` estiver livre para editar):
   usar `next/font/google` via `frontend/lib/fonts.ts`, que já exporta a
   config pronta:
   ```tsx
   // app/layout.tsx
   import { inter } from '@/lib/fonts'

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="pt-BR" className={inter.variable}>
         <body>{children}</body>
       </html>
     )
   }
   ```
   Isso ativa a variável `--font-inter`, que `--font-sans` já consome via
   fallback (`var(--font-inter, 'Inter', ui-sans-serif, system-ui, sans-serif)`)
   — nenhum outro arquivo precisa mudar quando isso acontecer.

## Componentes (`frontend/components/ui/`)

### `cn()` — `frontend/lib/utils.ts`

Helper de merge de classes (clsx + tailwind-merge), usado por todos os
componentes abaixo:

```ts
import { cn } from '@/lib/utils'

cn('px-2 py-1', condition && 'bg-accent', className)
```

### `Card` — `card.tsx`

`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
`CardFooter`. Fundo `bg-card`, borda `border-border`, `rounded-xl`, sombra
sutil que aumenta no hover.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Fluxo de caixa — Setembro</CardTitle>
    <CardDescription>Entradas e saídas do mês.</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### `SidebarItem` — `sidebar-item.tsx`

Item de navegação com ícone + label. O hover aplica `bg-accent` no elemento
**inteiro** (não só na cor do texto) — passe o mouse em qualquer ponto do
item. O estado ativo (`active`) usa `bg-secondary` de forma permanente,
sem depender de hover. Renderiza como `<Link>` (next/link) se `href` for
passado, ou como `<button>` com `onClick` caso contrário.

```tsx
import { SidebarItem } from '@/components/ui/sidebar-item'
import { Wallet } from 'lucide-react'

<SidebarItem icon={Wallet} label="Caixa" href="/business/caixa" active={pathname === '/business/caixa'} />
```

### `ViewToggle` — `view-toggle.tsx`

Par de botões ícone (grid / lista) controlado por props (`value` +
`onChange`), sem estado interno:

```tsx
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'

const [view, setView] = useState<ViewMode>('grid')
<ViewToggle value={view} onChange={setView} />
```

### `CardGrid` — `card-grid.tsx`

Wrapper que organiza os `children` em grid (`grid grid-cols-1 sm:grid-cols-2
md:grid-cols-3 gap-4`) ou lista vertical (`flex flex-col gap-2`) conforme a
prop `view`. Use junto com `ViewToggle`:

```tsx
import { CardGrid } from '@/components/ui/card-grid'

<CardGrid view={view}>
  {items.map((item) => <Card key={item.id}>...</Card>)}
</CardGrid>
```

## Página de demonstração

`frontend/app/design-preview/page.tsx` — abra `/design-preview` no navegador
para ver sidebar, cards (grid e lista) e o toggle funcionando com dados
fake. Essa rota é isolada e não conflita com as páginas de negócio
(`/business/*`) que outro agente está construindo em paralelo.

## Decisões e por que

- **Manual em vez de `npx shadcn@latest init`**: o CLI é interativo e mexe em
  vários arquivos ao mesmo tempo (`components.json`, `tailwind.config`,
  `globals.css`, possivelmente dependências) — com outro agente editando o
  mesmo `frontend/` em paralelo (páginas de negócio), rodar o CLI arriscava
  sobrescrever trabalho concorrente. Em vez disso, os tokens/CSS/config
  foram replicados manualmente a partir do WikiOS (mesmo usuário, mesma
  decisão de stack já validada em produção), preservando o resultado final
  do CLI sem o risco do modo interativo.
- **`app/layout.tsx` não foi tocado** propositalmente, pelo mesmo motivo —
  ver seção "Fonte" acima para como a Inter funciona sem isso.
- **`package.json` foi ajustado** (Tailwind v3 → v4, React 18 → 19,
  `@radix-ui/react-slot`/`shadcn-ui` → `@base-ui/react`/`shadcn`, +
  `lucide-react`, `tw-animate-css`) para alinhar com a decisão de stack já
  registrada para este projeto (Next 16 exige React 19; shadcn/ui atual usa
  Base UI, não Radix). `tailwind.config.js` (estilo v3) foi removido — Tailwind
  v4 não usa mais esse arquivo, o tema vive em `styles/design-tokens.css`.
