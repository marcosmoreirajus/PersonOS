'use client'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/motion/combobox'
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectList,
  MultiSelectTrigger,
} from '@/components/motion/multi-select'
import { categoryIcon } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

export type PickerCategory = {
  id: number
  name: string
  icon: string
}

/** Ícone monocromático em círculo neutro — mesmo tratamento da lista. */
function CategoryLabel({ category }: { category: PickerCategory }) {
  const Icon = categoryIcon(category.icon)
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="truncate">{category.name}</span>
    </span>
  )
}

/**
 * Seletor de categoria com busca, para formulário — uma categoria só.
 *
 * O campo **é** a busca: `ComboboxInput` vive dentro do trigger, mostrando o
 * rótulo selecionado quando fechado e o que se digita quando aberto. Foi
 * assim que o componente foi desenhado; montá-lo com um campo de busca
 * separado dentro do painel duplica a área de digitação e faz o trigger
 * parecer um `select` comum (era o estado anterior desta tela).
 *
 * Não existe opção "Sem categoria": o nulo só nasce de importação.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = 'Buscar ou escolher categoria...',
  id,
  className,
}: {
  categories: PickerCategory[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  className?: string
}) {
  return (
    <Combobox value={value} onValueChange={onChange} className={cn('w-full', className)}>
      <ComboboxTrigger className="min-w-0">
        <ComboboxInput id={id} placeholder={placeholder} aria-label="Categoria" />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxList ariaLabel="Categorias">
          {categories.map((c) => (
            <ComboboxItem key={c.id} value={String(c.id)} textValue={c.name} keywords={[c.name]}>
              <CategoryLabel category={c} />
            </ComboboxItem>
          ))}
          <ComboboxEmpty>Nenhuma categoria encontrada.</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * Seletor de categorias para filtro — várias ao mesmo tempo.
 *
 * O trigger mostra um **resumo** ("3 categorias"), não um token por escolha:
 * com tokens, o campo cresce a cada seleção e nunca volta ao tamanho
 * original, empurrando a tabela para baixo. A remoção individual continua
 * possível pelos chips de filtro abaixo da barra, que é onde o usuário já
 * olha para saber o que está filtrando.
 *
 * A largura vai no **root**, não no trigger: o root de `MultiSelect` é
 * `relative w-full`, então limitar só o trigger deixava o root ocupando a
 * linha inteira e empurrando os controles seguintes para baixo.
 */
export function CategoryMultiPicker({
  categories,
  value,
  onChange,
  placeholder = 'Todas as categorias',
  className,
}: {
  categories: PickerCategory[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
}) {
  return (
    <MultiSelect value={value} onValueChange={onChange} className={cn('w-full sm:w-56', className)}>
      <MultiSelectTrigger className="h-10 min-h-10 w-full min-w-0">
        {/* Campo único: digitar filtra, e o próprio placeholder resume o que
            está selecionado — o trigger não muda de altura. */}
        <MultiSelectInput
          placeholder={
            value.length === 0
              ? placeholder
              : value.length === 1
                ? (categories.find((c) => String(c.id) === value[0])?.name ?? '1 categoria')
                : `${value.length} categorias`
          }
          aria-label="Buscar categoria"
        />
      </MultiSelectTrigger>
      <MultiSelectContent>
        <MultiSelectList ariaLabel="Categorias">
          {categories.map((c) => (
            <MultiSelectItem key={c.id} value={String(c.id)} textValue={c.name} keywords={[c.name]}>
              <CategoryLabel category={c} />
            </MultiSelectItem>
          ))}
          <MultiSelectEmpty>Nenhuma categoria encontrada.</MultiSelectEmpty>
        </MultiSelectList>
      </MultiSelectContent>
    </MultiSelect>
  )
}
