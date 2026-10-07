# PersonOS — Design System

Sistema de design predominantemente preto & branco (base neutra `oklch`
chroma 0), com um canvas "papel" quente e UM acento âmbar restrito desde
2026-09-16 ("Papel & Âmbar") — ver seção Paleta de cores. Consistente com o
WikiOS (projeto irmão do mesmo usuário) na stack: shadcn/ui + Base UI +
Tailwind v4, preset `base-nova`.

Escopo deste documento: o sistema de design e os componentes reutilizáveis
em `frontend/components/ui/`, mais uma seção "Módulo Finanças" com regras
específicas de identidade daquele módulo (é o módulo mais avançado hoje,
onde a maioria das decisões de identidade foi validada primeiro). Páginas
de negócio (Founder, Direção, Validação, Caixa) e o backend não fazem parte
deste documento.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind v4** — CSS-first config (sem `tailwind.config.ts`; tema definido
  em `@theme` dentro do CSS)
- **shadcn/ui**, style `base-nova`, base color `neutral`, CSS variables
  ligadas — sobre **Base UI** (`@base-ui/react`) em vez de Radix
- **lucide-react** para ícones
- `clsx` + `tailwind-merge` via o helper `cn()`

## Paleta de cores

Base neutra em `oklch` chroma `0` (cinza puro) — mas **não é mais 100%
acromática**: a partir de 2026-09-16 (identidade "Papel & Âmbar", validada
em preview nos dias 14-16/09 e portada pro código real) o sistema ganhou um
canvas quente e um acento âmbar restrito, mantendo o resto neutro.

Definida em `frontend/styles/design-tokens.css`, importado por
`frontend/app/globals.css`. Segue o padrão de CSS variables do shadcn/ui:

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` (branco) | `oklch(0.145 0 0)` (quase preto) | fundo neutro (superfícies que NÃO são o canvas da página) |
| `--canvas` | `#f5f1e7` | `#201d17` | fundo da própria página (`<body>`) — canvas "papel" quente, distinto de `--background` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | texto principal |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | fundo de cards — continua branco/quase-preto mesmo com o canvas quente por baixo |
| `--muted` / `--muted-foreground` | cinza claro / cinza médio | cinza escuro / cinza claro | texto secundário, placeholders |
| `--accent` / `--accent-foreground` | cinza bem claro | cinza escuro | hover de itens (sidebar, menus) — **não confundir com `--amber-accent`**, são tokens diferentes |
| `--secondary` / `--secondary-foreground` | cinza claro | cinza escuro | badges, estado ativo |
| `--border` / `--input` | cinza claro | branco 10% opacidade | bordas, contornos de input |
| `--sidebar*` | variação de `--background`/`--accent` | idem | tokens dedicados da sidebar |
| `--destructive` | `oklch(0.577 0.245 27.325)` (vermelho) | `oklch(0.704 0.191 22.216)` | erro/exclusão |
| `--positive` | `#1f7a45` | `#4cba7f` | ganho/perda financeiro (ex.: delta "↑2% vs. mês anterior") — semântico, separado do `--amber-accent` de marca |
| `--amber-accent` | `#dd7635` | `#ec8a52` | acento de marca — **só em linha de gráfico em destaque e badge da categoria de MAIOR gasto do período** (rank 1 da paleta abaixo), nunca em CTA/botão (CTA continua preto sólido, sem exceção) |
| `--sage` | `#7c8c63` | `#96a67d` | paleta de categoria, rank 2 |
| `--dusty-blue` | `#5b7c99` | `#7fa0c0` | paleta de categoria, rank 3 |
| `--terracotta` | `#a8674f` | `#c07f65` | paleta de categoria, rank 4 |
| `--radius-card-cut` | `6px` | `6px` | raio assimétrico dos cards (ver seção Radius) |

**Paleta de categoria — cor por RANKING de gasto, não fixa por categoria**
(decisão de 2026-09-17, revisando a decisão de 14/09): a cor não vem mais de
`backend/data/categories.json` (o campo `color` de lá ficou sem uso, não foi
removido). Em vez disso, cada tela que monta o breakdown de despesas ordena
as categorias por valor decrescente e usa `categoryColorByRank(rank)`
(`frontend/lib/category-colors.ts`) pra atribuir: rank 0 → `--amber-accent`,
rank 1 → `--sage`, rank 2 → `--dusty-blue`, rank 3 → `--terracotta`, rank 4+
→ `--muted-foreground` (neutro, cauda residual). Isso cumpre a intenção
original de 14/09 ("âmbar marca a categoria de destaque") de fato — antes o
âmbar era travado numa categoria específica (Alimentação), não na maior do
período. Consumido por `finance/page.tsx` e `finance/relatorios/page.tsx` (os
dois pontos que montam `CategoryDatum[]` pro `CategoryBreakdown`). Nunca mais
de 4 tons simultâneos + neutro (paleta "pequena e controlada" mantida). Usada
em despesas/categorias — **nunca no Módulo Patrimônio**, que é propositalmente
P&B (ver "Módulo Finanças" abaixo).

**Balde "Sem categoria" — fora da escala de ranking** (decisão de 2026-09-21,
implementada em 2026-10-02, ver `docs/finance/spec.md` "Balde virtual"): gasto
com `category_id` nulo **não** é uma categoria e não disputa o ranking. As
categorias reais distribuem as cores entre si; o balde entra depois, na
posição pelo peso, em `--foreground` (o neutro forte: preto no claro, branco
no escuro), com o rótulo clicável para a fila "A revisar". Consequências
deliberadas sobre a regra acima:

- O âmbar marca a **maior categoria real**. Quando o balde é o maior gasto, ele
  encabeça a lista e o âmbar fica no 2º item, de propósito.
- O balde é o único tom além dos "4 + neutro". Ele é o oposto do neutro da
  cauda: grita em vez de sumir. Cinza foi proposto e **recusado**, porque
  esconderia justamente o que falta classificar.
- `--foreground` como cor de dado também aparece em Patrimônio (P&B), mas em
  outra tela, então não há colisão num mesmo gráfico.
- Nunca juntar o nulo em "Outros": "Outros" é uma escolha deliberada do usuário.

Montado por `rankWithUncategorized` (`finance/_components/CategoryBreakdown.tsx`),
usado pelas duas telas que montam o breakdown.

**Dark mode**: ativa via classe `.dark` na raiz do documento (padrão
shadcn/ui `@custom-variant dark (&:is(.dark *))`), não por
`prefers-color-scheme` diretamente. Desde 16/09 existe um controle real —
ver componente `ThemeToggle` abaixo — que decide entre claro/escuro/sistema
e aplica/remove `className="dark"` no `<html>`; antes disso a classe nunca
era tocada por nenhum componente.

## Radius

Sistema de **2 níveis com intenção** (adotado 16/09, inspirado na
referência "Ventriloc"), não mais uma escala única:

1. **Cards de dado** (`Card`, e qualquer componente que envolva conteúdo
   num "cartão"): canto cortado assimétrico, só o superior-esquerdo —
   `border-radius: var(--radius-card-cut) 0 0 0` (6px), sem sombra
   perceptível (profundidade só por borda 1px). Utilitário Tailwind gerado:
   `rounded-tl-card-cut`.
2. **CTA, toggles, tabs, pills** (botão principal, segmented controls tipo
   Pizza/Barras/Segmentada, filtros, `ViewToggle`, `ThemeToggle`,
   `EyeToggle`): **pill total**, `rounded-full` (999px) — decisão de 15/09,
   mantida mesmo depois da adoção do sistema Ventriloc (que sugeriria botão
   anguloso 0px) porque o CTA pill já estava validado antes; a exceção foi
   avisada e decidida explicitamente, não é inconsistência.

`--radius: 0.75rem` e a escala derivada (`--radius-sm` … `--radius-2xl`)
continuam existindo pra outros usos pontuais (ex.: inputs, popovers), mas
**cards e toggles não usam mais essa escala única** — usam a regra de 2
níveis acima.

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

**Peso e tracking de headings** (regra adotada 16/09, herdada da referência
"Ventriloc" — sem trocar a fonte, só a restrição): títulos de card
(`CardTitle`) usam **peso 400, nunca negrito** (`font-normal`, não
`font-medium`/`font-semibold`), com tracking levemente negativo
(`tracking-[-0.01em]`). Não se aplica a `<h1>` de página nem a valores
numéricos em destaque (esses continuam bold onde já eram).

## De onde vem cada componente (`ui/` × `motion/`)

Duas origens convivem no projeto, e a regra de qual usar precisa ser explícita
— sem ela, a mesma necessidade é resolvida de dois jeitos em telas diferentes,
e um dia alguém conserta o arquivo errado.

| Pasta | Origem | Papel |
|---|---|---|
| `components/ui/` | shadcn/ui sobre **Base UI** (padrão desde julho/2026) | vocabulário base: botão, card, diálogo, rótulo, select, tabela estática… |
| `components/motion/` | registry **beUI** | comportamento rico que o vocabulário base não tem: data grid, combobox com busca, multi-select, sidebar animada, input de formulário |

**Regra de escolha:** usar `ui/` por padrão. Recorrer a `motion/` só quando o
componente base não resolve o comportamento — e nunca manter os dois vivos
para a mesma função.

### Casos já decididos

- **Campo de formulário** → `motion/input`. Tem rótulo, mensagem de erro com
  shake e `reserveErrorLine`, que **reserva a linha da mensagem** e evita o
  formulário pular quando a validação aparece.
- **Campo de tela** (busca, filtro) → `ui/input`. Não tem rótulo nem
  validação; é um campo solto dentro de uma barra.
- **Tabela de dados** (ordenação, seleção, volume) → `motion/table`.
  **Tabela estática** (um resumo de poucas linhas) → `ui/table`, porque
  virtualizar cinco linhas é custo sem retorno.
- **Escolha entre muitas opções** → `motion/combobox` (uma) ou
  `motion/multi-select` (várias). O `ui/select` fica para listas curtas e
  fechadas, onde buscar não ajuda.
- **Feedback de operações assíncronas** → `motion/animated-toast-stack`
  (beUI), montado uma vez em `app/layout.tsx`. O `ApiToastStack` acompanha as
  mutações centralizadas em `lib/api.ts`, atualizando o mesmo aviso de
  carregamento para sucesso ou erro e preservando a mensagem que veio do
  backend. Consultas GET não geram toast de sucesso/carregamento.
- **Navegação estrutural** → `ui/app-shell` (`AppShell` + `SectionTabs`),
  construído sobre `motion/animated-sidebar`. A sidebar **recolhe para só
  ícones** pelo botão **dentro do cabeçalho dela**, à direita de "PersonOS"
  (decisão do Marco, 02/10), pelo rail na borda ou com Ctrl+B. Recolhida, o
  nome some e o botão vai para baixo do logo. O cabeçalho segue o molde do
  demo do beUI (logo `size-7 rounded-lg`, nome com
  `group-data-[state=collapsed]/sidebar:hidden`, X de fechar só no celular), e
  o botão usa o ícone e o estilo do trigger do demo (`PanelLeft`,
  `text-muted-foreground`, `hover:bg-muted`). No demo esse botão fica fora da
  sidebar; aqui ficou dentro de propósito. O `AppSidebarTrigger` no cabeçalho
  dos módulos só aparece no celular, para abrir a gaveta. O trigger do beUI
  não desenha nada sozinho.
  **Dois modos** (Configurações › Aparência › Menu lateral, cookie
  `personos-sidebar-modo`, só neste aparelho):
  - **Fixo:** o descrito acima.
  - **Automático:** a sidebar fica sempre recolhida no layout e expande **por
    cima** do conteúdo ao passar o mouse (abre em 150 ms, fecha 300 ms depois
    de sair) ou ao receber foco pelo teclado. Sem botão de recolher e sem
    rail.

  Sobrepor em vez de empurrar é de propósito: empurrar redimensionaria
  gráficos e tabelas a cada passada do mouse. Isso exigiu a prop
  `expandOnHover` no `animated-sidebar`, uma **extensão local** que o beUI
  não tem (está comentada no arquivo); reaplicar se o componente for
  atualizado pelo registry. O estado fica no cookie `personos-sidebar` (`lib/sidebar.ts`),
  lido no servidor pelo layout do módulo (`sidebarAbertaNoCookie`) para
  a página já nascer no estado certo. No `localStorage`, ela abriria e
  fecharia a cada carga. No celular, a sidebar vira gaveta e o mesmo botão
  a abre.

### Cuidados com os blocos do beUI

1. **Todo bloco declara `lib/utils.ts` entre os arquivos dele e sobrescreve o
   do projeto na instalação.** Já aconteceu 6 vezes. Depois de qualquer
   `shadcn add @beui/...`, conferir se o arquivo voltou ao reexport de `cn`.
2. **Blocos trazem primitivas próprias.** O `signup-form` veio com um segundo
   `input`, um segundo `checkbox` e uma árvore inteira de `button`. Podar o
   que duplica primitiva existente, na hora da instalação.
3. **Ler o código antes de compor.** Um componente copiado não tem
   documentação: a composição pretendida está nas classes e no `value` das
   peças. Compor por analogia com outra biblioteca compila e parece
   funcionar, mas produz o resultado errado.
4. **Perguntar que problema o componente resolve, não com o que ele se
   parece.** O `morphing-search` foi adotado como filtro de tabela e removido
   depois: ele é paleta de comando e limpa a própria busca ao fechar, por
   design.

### Componentes instalados e depois removidos

`ui/sidebar`, `ui/command`, `ui/sheet`, `ui/input-group`, `hooks/use-mobile` e
`motion/morphing-search` foram removidos por ficarem sem consumidor. Código
órfão não é verificado por nada — nem pelo runtime, nem pelo type checker, nem
pelo teste manual — e quando duplica algo em uso, cria dois caminhos para a
mesma coisa. Todos voltam com um `npx shadcn add <nome>` no dia em que
tiverem dono.

## Componentes (`frontend/components/`)

### `cn()` — `frontend/lib/utils.ts`

Helper de merge de classes (clsx + tailwind-merge), usado por todos os
componentes abaixo:

```ts
import { cn } from '@/lib/utils'

cn('px-2 py-1', condition && 'bg-accent', className)
```

### `Card` — `card.tsx`

`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
`CardFooter`. Fundo `bg-card`, borda `border-border`, canto cortado
assimétrico `rounded-tl-card-cut` (ver seção Radius), sombra sutil que
aumenta no hover. `CardTitle` usa peso 400 (nunca negrito) + tracking
negativo (ver seção Fonte).

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

### `Badge` — `badge.tsx`

Pill de categoria/tipo, tintado a 10% na cor recebida via
`color-mix(in srgb, var(--badge-color) 10%, transparent)` — nunca cor
sólida. Recebe uma cor **crua** (hex ou `var(--token)`) via prop `color` —
o componente em si é agnóstico de onde a cor vem. Desde 2026-09-17, na
paleta de despesas essa cor vem de `categoryColorByRank(rank)` (ver seção
Paleta de cores), não mais de um campo fixo em `categories.json`.

```tsx
import { Badge } from '@/components/ui/badge'
import { categoryColorByRank } from '@/lib/category-colors'

<Badge color={categoryColorByRank(rank)} icon={SomeIcon}>{category.name}</Badge>
```

**Não usar `Badge` pra status** (situação de algo — pago/pendente/atrasado):
status é um eixo semântico diferente de categoria/tipo e deve ficar num
elemento visual separado (texto + ponto colorido), mesmo que pareça "caber"
no mesmo formato de pill. Ver exemplo em `app/finance/agendadas/_components/UpcomingList.tsx`.

**Badge neutro (informativo):** quando o eixo não é categoria/tipo e não
precisa competir por atenção, usar `color="var(--muted-foreground)"`. Caso
de uso: Natureza em Agendadas (forma de recorrência — "Mensal", "À vista",
"Parcela 3/5"), ao lado do badge colorido de Tipo. Decidido em 2026-09-17
como badge no item e não como uma 3ª fileira de filtro, pra não poluir a tela.

### `ActionsMenu` — `actions-menu.tsx`

Botão único "⋯" que abre um menu com **ícone fixo por ação** (Ver detalhes
→ `Eye`, Pagar → `CheckCircle2`, Pular → `SkipForward`, Editar → `Pencil`),
em vez de links de texto soltos (que variam de largura e quebram
alinhamento entre linhas de uma lista). Construído sobre
`@base-ui/react/menu` (dá click-outside/Escape/foco de graça). O chamador
decide quais ações mandar por item — nem todo item precisa das mesmas.

```tsx
import { ActionsMenu, type ActionsMenuAction } from '@/components/ui/actions-menu'

const actions: ActionsMenuAction[] = [
  { key: 'details', label: 'Ver detalhes', icon: Eye, onSelect: () => {} },
]
<ActionsMenu actions={actions} />
```

### `ThemeToggle` — `theme-toggle.tsx`

Controle claro/escuro/sistema (3 botões ícone, `Sun`/`Moon`/`Monitor`),
persiste em `localStorage` e alterna a classe `.dark` na raiz — é o único
lugar do app que efetivamente toca essa classe ao **trocar** o tema. Vive em
**Configurações > Aparência** (`app/configuracoes/page.tsx`), com a nota
"Vale só neste aparelho" (decisão do Marco, 02/10). Ficava solto no rodapé
da sidebar; saiu de lá porque é ajuste de uma vez só, e também não foi para
o cabeçalho, ao lado do sino e do olho, porque esses são de uso frequente e
aquele cabeçalho existe só em Finanças, enquanto o tema vale para o app todo.

Aplicar o tema salvo na carga **não** é deste componente: é o script inline
no `<head>` do layout raiz (`THEME_INIT_SCRIPT`, em `lib/theme.ts`), que roda
antes da primeira pintura (sem flash claro no tema escuro) e em toda página.
Por isso o `<html>` tem `suppressHydrationWarning`.

A entrada **Configurações** fica no rodapé da sidebar global (`AppShell`),
fora da lista de módulos, porque é global e não um módulo (issue #2). Tema e
modo privacidade continuam no `localStorage` (são do aparelho); o que é da
pessoa, como os avisos do sino, vai para as preferências no backend.

### `EyeToggle` + `MoneyValue`/`ValuesVisibilityProvider` — `eye-toggle.tsx`, `money-value.tsx`

Sistema de privacidade: `ValuesVisibilityProvider` (Context) guarda o
estado "valores ocultos" (oculto por padrão, persiste em `localStorage`) e
deve envolver toda a árvore que precisa mascarar dinheiro — hoje montado
uma vez em `app/finance/layout.tsx`, cobrindo todas as telas do módulo.
`EyeToggle` é o botão que alterna o estado (persistente no shell, ao lado
do CTA principal). `MoneyValue` é o componente que formata um número em R$
e o mascara (`R$ ••••,••`) quando o estado está oculto — lê o contexto
sozinho, não precisa receber `hidden` por prop.

```tsx
// app/<modulo>/layout.tsx
import { ValuesVisibilityProvider } from '@/components/ui/money-value'
<ValuesVisibilityProvider>{children}</ValuesVisibilityProvider>

// em qualquer página dentro do provider
import { MoneyValue } from '@/components/ui/money-value'
<MoneyValue value={1234.5} />
```

Regra: mascarar todo valor monetário **diretamente visível** (inclusive
dentro de popovers/menus abertos), mas não o conteúdo de tooltips
(`title=`/`<title>` de SVG) — mesmo padrão já usado no preview original.
Percentuais nunca são mascarados (são relativos, não saldo).

### `MonthPicker` — `month-picker.tsx`

Dropdown de mês/ano (navegação de ano + grid de 12 meses), construído sobre
`@base-ui/react/popover`. Desde 18/09 tem **setas ‹ › fora do popover** pra
pular 1 mês; dentro do popover, as setas de ano **trocam o ano na hora**
(mantendo o mês; antes só mudavam a visualização e parecia que o ano não
mudava) e a grade escolhe o mês. O componente só guarda o mês — quem usa
decide o que filtrar com ele. Usado em Visão Geral e Patrimônio.

### `MonthStrip` — `month-strip.tsx`

Faixa com os **12 meses do ano sempre visíveis** (pills num trilho `bg-muted`,
mesmo visual do segmented control) + setas de ano. Usar no lugar do
`MonthPicker` quando a tela precisa mostrar algo **por mês sem abrir nada**.
Criada em 18/09 porque, com o dropdown, o Marco precisava selecionar um mês
pra descobrir se ele tinha pendência.

Prop opcional `getMonthAlert(month) => ReactNode | null`: se retornar algo, o
mês ganha um **ponto vermelho** (`--destructive`) e o conteúdo aparece num
tooltip ao passar o mouse. Uso atual: Agendadas passa um **alerta único de
pendências** (`PendingAlert`: contas a pagar + receitas a receber + quantas
em atraso). Conciliação entra como mais uma linha do mesmo alerta quando
existir. O mês atual (hoje) fica sublinhado quando não está selecionado. Em
tela estreita, só a faixa rola na horizontal, não a página.

### `Sparkline` — `sparkline.tsx`

Linha de tendência simples (SVG à mão, não `recharts` — ver nota abaixo)
a partir de um array de números. Sem comparação com período anterior por
padrão — só desenha o que existe. Usado dentro de `StatCard` na Visão
Geral do Finanças.

> **Por que SVG à mão em vez de `recharts`:** o gráfico de pizza original
> do Dashboard (`recharts`) tinha um bug de renderização não diagnosticado
> (grupo do gráfico renderizava sem nenhum `<path>` dentro). Pra não
> arriscar o mesmo problema nos gráficos novos (sparklines, "Resultado do
> mês", donuts de categoria/patrimônio), todos foram refeitos como SVG
> gerado a partir do dado real, sem depender de `recharts`. Ver componentes
> `ResultChart`/`CategoryBreakdown`/`EvolutionChart` em `app/finance/`.

## Módulo Finanças — regras específicas

Fora do escopo original deste documento (que cobria só `components/ui/`),
mas registrado aqui porque afeta como os componentes acima são usados:

- **Despesas = colorido, Patrimônio = P&B.** Categorias de despesa usam a
  paleta de categoria (ver seção Paleta de cores); classes de investimento
  em Patrimônio **nunca** recebem cor própria — usam peso por opacidade
  (`[1, 0.6, 0.35, 0.18]`, maior classe = opacidade cheia) sobre
  `var(--foreground)`. Decisão de 14/09, reforça a distinção semântica
  "atenção" (despesa) vs. "sóbrio/estável" (patrimônio).
- **Acento âmbar só na Visão Geral hoje.** O gráfico "Resultado do mês" usa
  `var(--amber-accent)` na linha/preenchimento — é o único lugar do app que
  usa esse token pra uma linha de gráfico até agora. Gráficos de Patrimônio
  (Evolução Patrimonial) usam `var(--foreground)`, consistente com a regra
  P&B acima.
- **`CategoryBreakdown`** (`app/finance/_components/CategoryBreakdown.tsx`)
  é o componente compartilhado do card "Onde o dinheiro saiu" (toggle
  Pizza/Barras/Segmentada) — usado tanto na Visão Geral quanto em
  Relatórios, mesmo dado, apresentações diferentes.

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
- **Canvas quente + acento âmbar (2026-09-14, portado pro real em 16/09):**
  o P&B 100% acromático original foi abandonado depois de 4 referências
  visuais independentes (Ventriloc, Rox, Steep, imagem de trading app)
  convergirem pra um canvas "papel" quente + UM único acento de marca. Cor
  no CTA (padrão de uma das referências) foi descartada — o CTA preto
  sólido já cumpria o papel de contraste, trocar reverteria identidade P&B
  sem ganho real. 100% acromático sem nenhum acento também foi descartado —
  não resolvia a baixa escaneabilidade das categorias nem dava destaque a
  ponto de dado em gráfico.
- **Sistema de raio de 2 níveis em vez de escala única (2026-09-16):**
  ver seção Radius. A alternativa (adotar também "botão anguloso 0px" da
  referência Ventriloc) foi descartada especificamente pro CTA/toggles,
  que já tinham raio pill validado antes — resolveu-se aplicando o sistema
  novo só onde não conflitava com decisão anterior, em vez de reverter uma
  coisa ou outra.
- **Badges tintadas a 10% via `color-mix()`** em vez de pill sólida
  colorida (outra referência analisada) — mais consistente com a
  austeridade do resto do sistema; funciona automaticamente com o toggle
  de tema porque a variável de origem já muda sozinha entre claro/escuro.
- **Privacidade (`MoneyValue`) como Context único no shell**, não estado
  local por página — decisão corrigida em 16/09 depois de perceber que a
  primeira versão só mascarava valores na Visão Geral; a "decisão de
  15/09" original já previa cobertura de "praticamente todo valor
  monetário visível" no módulo inteiro, não só uma tela.
