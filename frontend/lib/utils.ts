/**
 * Merge condicional de classes Tailwind.
 *
 * Reexporta o pacote `cn` (substituto direto de clsx + tailwind-merge, sem
 * dependencias) em vez de ter implementacao propria: os componentes gerados
 * pelo shadcn importam `cn` direto desse pacote. Com uma implementacao
 * propria aqui, o projeto teria **duas** funcoes de merge — a dos componentes
 * gerados e a dos feitos a mao, que importam de `@/lib/utils`. Duas
 * implementacoes do mesmo contrato e o tipo de divergencia silenciosa que ja
 * custou caro no backend deste projeto.
 *
 * ATENCAO: todo bloco do registry `@beui` declara `lib/utils.ts` entre os
 * arquivos dele e **sobrescreve este arquivo** na instalacao. Ja aconteceu 5x
 * em 22/09 (morphing-search, signup-form, table, combobox, multi-select).
 * Depois de qualquer `shadcn add @beui/...`, conferir se voltou ao reexport.
 */
export { cn } from 'cn'
