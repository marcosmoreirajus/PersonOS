'use client'

import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyValue } from '@/components/ui/money-value'
import { CURRENT_USER_ID, api } from '@/lib/api'
import { CartaoDialog, type Cartao, type ContaPagadora } from './_components/CartaoDialog'
import { FaturasDoCartao } from './_components/FaturasDoCartao'

/**
 * Cartões (Fatia 5, tickets #21 e #26): cadastro e, em cada cartão, as faturas
 * com o detalhe das compras. Pagamento e limite disponível chegam nos tickets
 * seguintes. Cartão é dívida com ciclo, não
 * Conta — ver GLOSSARY.md.
 */
export default function CartoesPage() {
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null)
  const [contas, setContas] = useState<ContaPagadora[]>([])
  const [error, setError] = useState<string | null>(null)
  // `null` fechado; `'novo'` criando; um cartão = editando. O `key` do diálogo
  // zera o formulário a cada abertura.
  const [dialogo, setDialogo] = useState<Cartao | 'novo' | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [lista, contasDoUsuario] = await Promise.all([
        api<Cartao[]>(`/api/cards/user/${CURRENT_USER_ID}`),
        // As contas só alimentam a escolha da conta pagadora: degradam sem derrubar a tela.
        api<ContaPagadora[]>(`/api/accounts/user/${CURRENT_USER_ID}`).catch(() => []),
      ])
      setCartoes(lista)
      setContas(contasDoUsuario)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os cartões.')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados: o setState vem depois do await
    carregar()
  }, [carregar])

  const nomeDaConta = (id: number | null) => contas.find((c) => c.id === id)?.name

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Cartões</h1>
        <Button onClick={() => setDialogo('novo')}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Novo cartão
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}

      {!cartoes && !error && <p className="text-muted-foreground">Carregando...</p>}

      {cartoes && cartoes.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum cartão ainda</CardTitle>
            <CardDescription>
              Cadastre seus cartões de crédito para acompanhar a dívida de cada um. Cartão não é uma conta: é o que você deve, com limite e ciclo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setDialogo('novo')}>
              <CreditCard className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Cadastrar o primeiro cartão
            </Button>
          </CardContent>
        </Card>
      )}

      {cartoes && cartoes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cartoes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardDescription className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-foreground">
                    <CreditCard className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    {c.name}
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setDialogo(c)}>
                    <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </CardDescription>
                <CardTitle className="text-2xl">
                  <MoneyValue value={c.limit} />
                </CardTitle>
                <CardDescription>Limite</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>Fecha no dia {c.closing_day}</span>
                <span>Vence no dia {c.due_day}</span>
                {nomeDaConta(c.default_payer_account_id) && <span>Paga por {nomeDaConta(c.default_payer_account_id)}</span>}
                <div className="mt-3 border-t border-border pt-3">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Faturas</span>
                  <FaturasDoCartao cardId={c.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogo && (
        <CartaoDialog
          key={dialogo === 'novo' ? 'novo' : dialogo.id}
          open
          onOpenChange={(aberto) => !aberto && setDialogo(null)}
          cartao={dialogo === 'novo' ? null : dialogo}
          contas={contas}
          onSaved={carregar}
        />
      )}
    </div>
  )
}
