'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Carregando } from '@/components/ui/carregando'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
// Formulário usa o Input animado (rótulo, erro com shake e linha de erro
// reservada). Ver a convenção em docs/design-system.md: campo de formulário
// usa `motion/input`; campo de tela (busca, filtro) usa `ui/input`.
import { Input } from '@/components/motion/input'
import { CampoValor } from '@/components/ui/campo-valor'
import { api } from '@/lib/api'
import { lerValor, valorParaCampo } from '@/lib/valor'
import { cn } from '@/lib/utils'
import { hojeLocal } from '@/lib/dates'
import { contaInicial, guardarUltimaConta, lerUltimaConta } from '@/lib/conta-lancamento'
import {
  cartaoInicial,
  corpoDoDestino,
  erroDoDestino,
  repeticaoNoDestino,
  repeticoesDoDestino,
  type Destino,
} from '@/lib/lancamento-destino'
import { CategoryPicker, categoriasDoTipo } from '../../_components/CategoryPicker'
import { NovaContaDialog, type Conta } from '../../importar/_components/NovaContaDialog'

export type Category = {
  id: number
  name: string
  icon: string
  type: 'expense' | 'income' | 'both'
}

/** O que o diálogo precisa saber de um lançamento pra editar ou duplicar. */
export type DialogSeed = {
  /** Presente = edição; ausente = criação (inclusive ao duplicar). */
  id?: number
  type: 'income' | 'expense'
  amount: number
  description: string | null
  category_id: number | null
  /** Conta do lançamento de origem; nula nos antigos, que nasceram sem conta. */
  account_id?: number | null
  /** Compra no cartão (issue #26): em edição o destino é mostrado, não trocado. */
  card_id?: number | null
  due_date: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  userId: number
  onSaved: () => void
  /** Preenche o formulário: edição (com `id`) ou duplicação (sem `id`). */
  seed?: DialogSeed | null
  /**
   * Tipo a pré-selecionar numa criação — os botões rápidos da Visão Geral
   * (Despesas/Entradas/Transferência) abrem aqui o mesmo cadastro já apontado.
   * Vira a escolha padrão quando não há `seed`.
   */
  initialType?: 'expense' | 'income'
}

type Repeticao = 'avista' | 'installment' | 'recurring'
type Frequencia = 'monthly' | 'biweekly' | 'weekly'

const REPETICOES: { value: Repeticao; label: string }[] = [
  { value: 'avista', label: 'À vista' },
  { value: 'installment', label: 'Parcelado' },
  { value: 'recurring', label: 'Recorrente' },
]

const FREQUENCIAS: { value: Frequencia; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'weekly', label: 'Semanal' },
]

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function hoje() {
  return hojeLocal()
}

/**
 * Lançamento manual — criação, edição e duplicação.
 *
 * Duas decisões da sabatina moldam este formulário:
 * - a **data é escolhida** (antes o backend gravava sempre `new Date()`, o que
 *   fazia o histórico mentir quando o registro era feito dias depois);
 * - a **categoria é obrigatória**. É o que garante que `category_id = null`
 *   signifique sempre "o classificador não soube", nunca "o usuário pulou" —
 *   e é por isso que o seletor não tem opção "Sem categoria".
 */
export function TransactionDialog({ open, onOpenChange, categories, userId, onSaved, seed, initialType }: Props) {
  const editando = Boolean(seed?.id)

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(hoje)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [repeticao, setRepeticao] = useState<Repeticao>('avista')
  const [parcelas, setParcelas] = useState('12')
  const [frequencia, setFrequencia] = useState<Frequencia>('monthly')
  const [ate, setAte] = useState('')
  const [saving, setSaving] = useState(false)
  const [erros, setErros] = useState<{ amount?: string; description?: string; category?: string; account?: string }>({})
  // Conta (issue #22): obrigatória ao criar. As contas vêm da API ao abrir; a
  // preseleção (última usada) só entra depois delas, para não apontar uma conta
  // que já foi apagada.
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [accountId, setAccountId] = useState('')
  const [novaContaAberta, setNovaContaAberta] = useState(false)
  // Cartão (issue #26): a compra pede o Cartão no lugar da Conta. Só despesa
  // cabe no cartão; os cartões vêm da API ao abrir, como as contas.
  const [destino, setDestino] = useState<Destino>('conta')
  const [cartoes, setCartoes] = useState<{ id: number; name: string }[] | null>(null)
  const [cardId, setCardId] = useState('')

  // Reidrata ao abrir: em edição e em duplicação o formulário parte do
  // lançamento de origem; em criação, de um estado limpo. Feito durante o
  // render (ajuste de estado por mudança de prop, como a doc do React indica)
  // e não num efeito: assim o diálogo já abre com os valores certos.
  const [hidratadoPara, setHidratadoPara] = useState<{ open: boolean; seed: Props['seed'] }>({
    open: false,
    seed: undefined,
  })

  function hidratar() {
    setErros({})
    setDestino('conta')
    setCardId('')
    if (seed) {
      setType(seed.type)
      setAmount(valorParaCampo(seed.amount))
      setDescription(seed.description ?? '')
      setCategoryId(seed.category_id != null ? String(seed.category_id) : '')
      setDate(seed.due_date)
      setAccountId(seed.account_id != null ? String(seed.account_id) : '')
    } else {
      setAccountId('')
      setAmount('')
      setDescription('')
      // Sem seed, o tipo cabe a quem abriu: os botões rápidos da Visão Geral
      // entram já decidindo se é despesa ou entrada.
      setType(initialType ?? 'expense')
    }
    // Repetição não é herdada ao duplicar: duplicar copia o lançamento,
    // não o contrato que o gerou — senão um clique criaria 24 registros.
    setRepeticao('avista')
  }

  if (hidratadoPara.open !== open || hidratadoPara.seed !== seed) {
    setHidratadoPara({ open, seed })
    if (open) hidratar()
  }

  // Carrega as contas a cada abertura (uma conta recém-criada em outra tela
  // precisa aparecer) e preseleciona a última usada. Em edição de lançamento
  // antigo sem conta o campo fica vazio: editar não obriga a escolher uma.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api<Conta[]>(`/api/accounts/user/${userId}`)
      .then((lista) => {
        if (cancelled) return
        setContas(lista)
        if (!editando) {
          setAccountId((atual) => {
            if (atual && lista.some((c) => String(c.id) === atual)) return atual
            const inicial = contaInicial(lista, lerUltimaConta(window.localStorage, userId))
            return inicial != null ? String(inicial) : ''
          })
        }
      })
      .catch(() => {
        if (!cancelled) setContas([])
      })
    // Os cartões só alimentam a escolha "Cartão": falhar aqui não derruba o lançamento de conta.
    api<{ id: number; name: string }[]>(`/api/cards/user/${userId}`)
      .then((lista) => {
        if (cancelled) return
        setCartoes(lista)
        const unico = cartaoInicial(lista)
        setCardId((atual) => (atual && lista.some((c) => String(c.id) === atual) ? atual : unico != null ? String(unico) : ''))
      })
      .catch(() => {
        if (!cancelled) setCartoes([])
      })
    return () => {
      cancelled = true
    }
  }, [open, userId, editando])

  /**
   * Prévia da divisão.
   *
   * Quando o total não divide exato, a sobra vai para a **primeira** parcela —
   * convenção do crédito parcelado no Brasil, e é mostrada em vez de
   * escondida: o total exibido no app é a soma das parcelas, então precisa
   * bater com o que foi digitado.
   *
   * A parcela é truncada para baixo (não arredondada) para a sobra ser sempre
   * positiva e a primeira ficar sempre a maior.
   */
  const previaParcelas = (() => {
    const total = (lerValor(amount) ?? 0)
    const n = Number(parcelas)
    if (!total || !n || n < 2) return 'Informe o total e o nº de parcelas'
    const parcela = Math.floor((total / n) * 100) / 100
    const primeira = Math.round((total - parcela * (n - 1)) * 100) / 100
    return primeira === parcela
      ? `${n}x de ${moeda(parcela)}`
      : `1x de ${moeda(primeira)} + ${n - 1}x de ${moeda(parcela)}`
  })()

  async function submit(addAnother: boolean) {
    const valor = (lerValor(amount) ?? 0)
    // Todos os campos são validados de uma vez: apontar um erro por vez faz o
    // usuário corrigir, salvar e descobrir o próximo.
    const novos = {
      amount: !valor || valor <= 0 ? 'Informe um valor maior que zero.' : undefined,
      description: !description.trim() ? 'A descrição é obrigatória.' : undefined,
      category: !categoryId ? 'Escolha uma categoria.' : undefined,
      // Só a criação exige conta; editar um lançamento antigo sem conta não.
      account: !editando ? erroDoDestino(destino, accountId, cardId) : undefined,
    }
    setErros(novos)
    if (novos.amount || novos.description || novos.category || novos.account) return

    setSaving(true)
    try {
      const corpo = {
        category_id: Number(categoryId),
        type,
        amount: valor,
        description: description.trim(),
        due_date: date,
      }

      // Série com fim conhecido (nº de parcelas ou data-limite) gera tudo; sem
      // fim, o backend materializa a janela de 12 meses.
      const series =
        repeticao === 'installment'
          ? { kind: 'installment', frequency: 'monthly', total_count: Number(parcelas) }
          : repeticao === 'recurring'
            ? { kind: 'recurring', frequency: frequencia, end_date: ate || null }
            : null

      const editandoLancamento = Boolean(editando)
      if (editandoLancamento) {
        // Escopo amplo em edição depende de um passo a mais na interface;
        // por ora a edição é sempre pontual.
        // A conta só vai se mudou: reenviar a antiga não tem efeito, e um
        // lançamento antigo sem conta segue sem ela se ninguém escolher.
        const trocouConta = accountId && accountId !== String(seed?.account_id ?? '')
        await api(`/api/transactions/${seed!.id}`, {
          method: 'PATCH',
          body: { ...corpo, ...(trocouConta ? { account_id: Number(accountId) } : {}), scope: 'only_this' },
        })
        if (trocouConta) guardarUltimaConta(window.localStorage, userId, Number(accountId))
      } else {
        await api('/api/transactions', {
          method: 'POST',
          body: {
            ...corpo,
            user_id: userId,
            ...corpoDoDestino(destino, accountId, cardId),
            // Lançamento avulso é fato consumado: nasce efetivado na data
            // escolhida. Série é compromisso futuro — as ocorrências nascem
            // sem efetivação, e cada uma é marcada quando o dinheiro se move.
            settled_at: series ? null : date,
            source: 'manual',
            ...(series ? { series } : {}),
          },
        })
        if (destino === 'conta') guardarUltimaConta(window.localStorage, userId, Number(accountId))
      }

      onSaved()
      if (addAnother) {
        // Tipo, data e categoria ficam: quem lança em sequência repete os três.
        setAmount('')
        setDescription('')
      } else {
        onOpenChange(false)
      }
    } catch (e) {
      // A frase do backend quando houver — "Transaction not found" diz mais do
      // que "não foi possível salvar".
      setErros({ amount: e instanceof Error ? e.message : 'Não foi possível salvar a transação.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar lançamento' : 'Lançamento manual'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Entrada x Saída — o ativo tintado pela cor semântica do eixo. */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(['income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={destino === 'cartao' && t === 'income'}
                onClick={() => {
                  setType(t)
                  // Trocar entrada/saída pode invalidar a categoria escolhida:
                  // manter uma que não pertence ao novo tipo gravaria o par
                  // errado em silêncio.
                  const cat = categories.find((c) => String(c.id) === categoryId)
                  if (cat && cat.type !== 'both' && cat.type !== t) setCategoryId('')
                }}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  type === t
                    ? t === 'income'
                      ? 'bg-background text-positive shadow-sm'
                      : 'bg-background text-destructive shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'income' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CampoValor
              id="amount"
              label={repeticao === 'installment' ? 'Valor total' : 'Valor'}
              value={amount}
              onChange={setAmount}
              error={erros.amount}
              reserveErrorLine
            />
            <Input id="date" label="Data" type="date" value={date} onChange={setDate} reserveErrorLine />
          </div>

          <Input
            id="description"
            label="Descrição"
            placeholder="Descreva a transação"
            value={description}
            onChange={setDescription}
            error={erros.description}
            reserveErrorLine
          />

          {!editando && (
            <Field>
              <FieldLabel>Repetição</FieldLabel>
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {REPETICOES.filter((r) => repeticoesDoDestino(destino).includes(r.value)).map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRepeticao(r.value)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      repeticao === r.value
                        ? 'bg-background font-medium text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {repeticao === 'installment' && (
                <div className="mt-2 flex items-end gap-3">
                  <Input
                    id="parcelas"
                    label="Parcelas"
                    type="number"
                    min={2}
                    value={parcelas}
                    onChange={setParcelas}
                    className="w-32"
                  />
                  {/* Digita-se o total e o app mostra a parcela — é assim que
                      a compra é feita ("6.000 em 24x"). O que fica guardado é o
                      valor da parcela, que é o que aparece na fatura e o que a
                      importação vai tentar casar. */}
                  <p className="pb-1.5 text-xs text-muted-foreground">{previaParcelas}</p>
                </div>
              )}

              {repeticao === 'recurring' && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div className="flex gap-1 rounded-xl bg-muted p-1">
                    {FREQUENCIAS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFrequencia(f.value)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm transition-colors',
                          frequencia === f.value
                            ? 'bg-background font-medium text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <Input id="ate" label="Até (opcional)" type="date" value={ate} onChange={setAte} className="w-44" />
                  <p className="pb-1.5 text-xs text-muted-foreground">
                    {ate ? 'Gera até a data informada.' : 'Sem data de fim: gera os próximos 12 meses.'}
                  </p>
                </div>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="category">Categoria</FieldLabel>
            {/* Combobox com busca: com 17 categorias (e mais quando virarem
                customizáveis), percorrer a lista inteira num select nativo é
                atrito em cima do caminho mais usado do app. */}
            <CategoryPicker
              id="category"
              categories={categoriasDoTipo(categories, type)}
              value={categoryId}
              onChange={setCategoryId}
            />
            {erros.category && <FieldError>{erros.category}</FieldError>}
          </Field>

          {/* Conta (issue #22): poucas por usuário, então botões em vez de
              lista. Sem nenhuma, o campo vira o convite para cadastrar a
              primeira — o mesmo "+ Conta" do quadro da Visão Geral. */}
          <Field>
            {/* Conta | Cartão (issue #26): a compra no cartão cai na fatura e
                não mexe no saldo da conta. Só em criação; em edição o destino
                é mostrado, não trocado. */}
            {!editando && (
              <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Destino do lançamento">
                {(['conta', 'cartao'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={destino === d}
                    onClick={() => {
                      setDestino(d)
                      if (d === 'cartao') {
                        // Cartão só recebe compra: despesa, à vista ou parcelada.
                        setType('expense')
                        setRepeticao(repeticaoNoDestino('cartao', repeticao))
                        const cat = categories.find((c) => String(c.id) === categoryId)
                        if (cat && cat.type === 'income') setCategoryId('')
                      }
                      setErros((e) => ({ ...e, account: undefined }))
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm transition-colors',
                      destino === d ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {d === 'conta' ? 'Conta' : 'Cartão'}
                  </button>
                ))}
              </div>
            )}
            <FieldLabel>{editando ? (seed?.card_id ? 'Cartão' : 'Conta') : destino === 'cartao' ? 'Cartão *' : 'Conta *'}</FieldLabel>
            {editando && seed?.card_id ? (
              <p className="text-xs text-muted-foreground">Compra no cartão: o cartão não muda por aqui.</p>
            ) : destino === 'cartao' ? (
              cartoes === null ? (
                <Carregando compacto rotulo="Carregando cartões" />
              ) : cartoes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Cadastre um cartão em Cartões para lançar compras.</p>
              ) : (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cartão da compra">
                  {cartoes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={cardId === String(c.id)}
                      onClick={() => setCardId(String(c.id))}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        cardId === String(c.id)
                          ? 'border-foreground bg-background font-medium text-foreground shadow-sm'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )
            ) : contas === null ? (
              <Carregando compacto rotulo="Carregando contas" />
            ) : contas.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-muted-foreground">Cadastre uma conta para lançar.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setNovaContaAberta(true)}>
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Conta
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Conta do lançamento">
                {contas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={accountId === String(c.id)}
                    onClick={() => setAccountId(String(c.id))}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                      accountId === String(c.id)
                        ? 'border-foreground bg-background font-medium text-foreground shadow-sm'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {c.name}
                  </button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setNovaContaAberta(true)}>
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Conta
                </Button>
              </div>
            )}
            {erros.account && <FieldError>{erros.account}</FieldError>}
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {!editando && (
              <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Salvar e adicionar outra
              </Button>
            )}
            <Button onClick={() => submit(false)} pending={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar transação'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Cadastro da primeira conta (ou de outra) sem sair do lançamento. */}
    <NovaContaDialog
      open={novaContaAberta}
      onOpenChange={setNovaContaAberta}
      userId={userId}
      onCreated={(c) => {
        setContas((cs) => [...(cs ?? []), c])
        setAccountId(String(c.id))
        setErros((e) => ({ ...e, account: undefined }))
      }}
    />
    </>
  )
}

export default TransactionDialog
