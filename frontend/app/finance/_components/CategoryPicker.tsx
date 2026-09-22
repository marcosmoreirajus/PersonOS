'use client'

import { Check } from 'lucide-react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/motion/combobox'
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/motion/multi-select'
import { categoryIcon } from '@/lib/category-icons'

export type PickerCategory = {
  id: number
  name: string
  icon: string
}

/** Ícone monocromático em círculo neutro — mesmo tratamento da lista. */
function CategoryLabel({ category }: { category: PickerCategory }) {
  const Icon = categoryIcon(category.icon)
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </span>
      {category.name}
    </span>
  )
}

/**
 * Seletor de categoria com busca, para formulário — uma categoria só.
 *
 * Com 17 categorias (e mais quando forem customizáveis), o `<select>` nativo
 * obriga a percorrer a lista inteira; aqui se digita "ali" e chega em
 * Alimentação. Não existe opção "Sem categoria": o nulo só nasce de
 * importação, nunca de escolha do usuário.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = 'Escolha uma categoria',
  id,
}: {
  categories: PickerCategory[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}) {
  const selected = categories.find((c) => String(c.id) === value)

  return (
    <Combobox value={value} onValueChange={onChange}>
      <ComboboxTrigger className="w-full" >
        <ComboboxValue placeholder={placeholder}>
          {selected ? <CategoryLabel category={selected} /> : null}
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput placeholder="Buscar categoria..." ref={undefined} id={id} />
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
 * Seletor de categorias para filtro — várias ao mesmo tempo, com token
 * removível por categoria escolhida.
 */
export function CategoryMultiPicker({
  categories,
  value,
  onChange,
  placeholder = 'Todas as categorias',
}: {
  categories: PickerCategory[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  return (
    <MultiSelect value={value} onValueChange={onChange}>
      <MultiSelectTrigger className="min-w-[220px]">
        <MultiSelectValue placeholder={placeholder} />
      </MultiSelectTrigger>
      <MultiSelectContent>
        <MultiSelectInput placeholder="Buscar categoria..." />
        <MultiSelectList ariaLabel="Categorias">
          {categories.map((c) => (
            <MultiSelectItem key={c.id} value={String(c.id)} textValue={c.name} keywords={[c.name]}>
              <span className="flex w-full items-center justify-between gap-2">
                <CategoryLabel category={c} />
                {value.includes(String(c.id)) && (
                  <Check className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                )}
              </span>
            </MultiSelectItem>
          ))}
          <MultiSelectEmpty>Nenhuma categoria encontrada.</MultiSelectEmpty>
        </MultiSelectList>
      </MultiSelectContent>
    </MultiSelect>
  )
}
