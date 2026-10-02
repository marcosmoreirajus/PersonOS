'use client'

import { useEffect, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SidebarModeToggle } from '@/components/ui/sidebar-mode-toggle'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { JANELAS, opcaoJanela, type JanelaAVencer, type Preferencias } from '@/lib/avisos'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const CURRENT_USER_ID = 1

type Mudanca = Partial<Pick<Preferencias, 'em_atraso' | 'a_vencer' | 'janela_a_vencer'>>

const OPCOES_JANELA = JANELAS.map((j) => ({ value: String(j), label: opcaoJanela(j) }))

/**
 * Configurações — Avisos (issue #2) e Aparência.
 *
 * Avisos são da pessoa e ficam no backend; o tema é do aparelho e fica no
 * navegador. A seção Aparência diz isso, para não parecer que o tema segue
 * o usuário para outro aparelho.
 *
 * Cada mudança grava na hora, parcial: mexer na janela não apaga o "visto".
 * O sino recarrega as preferências ao trocar de tela, então volta já com a
 * configuração nova.
 */
export default function ConfiguracoesPage() {
  const [prefs, setPrefs] = useState<Preferencias | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/preferences/user/${CURRENT_USER_ID}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => !cancelled && setPrefs(json.data))
      .catch(() => !cancelled && setErro('Não foi possível carregar as configurações.'))
    return () => {
      cancelled = true
    }
  }, [])

  async function recarregar() {
    const res = await fetch(`${API_URL}/api/preferences/user/${CURRENT_USER_ID}`)
    if (res.ok) setPrefs((await res.json()).data)
  }

  async function salvar(mudanca: Mudanca) {
    if (!prefs) return
    setPrefs({ ...prefs, ...mudanca })
    setSalvo(false)
    try {
      const res = await fetch(`${API_URL}/api/preferences/user/${CURRENT_USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mudanca),
      })
      if (!res.ok) throw new Error(String(res.status))
      setPrefs((await res.json()).data)
      setErro(null)
      setSalvo(true)
    } catch {
      // Volta para o que o backend tem de fato — não para um retrato tirado
      // no clique, que pode já estar velho se houve outra mudança no meio.
      setErro('Não foi possível salvar. A tela mostra o que está gravado.')
      recarregar().catch(() => {})
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{erro}</div>
      )}

      {!prefs ? (
        !erro && <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Avisos</CardTitle>
            <CardDescription>
              O que o sino de Finanças lembra. Só prazos: lançamentos sem categoria ficam em &quot;A revisar&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <Checkbox
                  id="em-atraso"
                  checked={prefs.em_atraso}
                  onCheckedChange={(v) => salvar({ em_atraso: v === true })}
                />
                <FieldContent>
                  <FieldLabel htmlFor="em-atraso">Em atraso</FieldLabel>
                  <FieldDescription>Lançamentos vencidos e ainda sem baixa.</FieldDescription>
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="a-vencer"
                  checked={prefs.a_vencer}
                  onCheckedChange={(v) => salvar({ a_vencer: v === true })}
                />
                <FieldContent>
                  <FieldLabel htmlFor="a-vencer">A vencer</FieldLabel>
                  <FieldDescription>Contas e recebimentos em aberto que vencem dentro da janela.</FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="janela">Janela do &quot;a vencer&quot;</FieldLabel>
                <Select
                  items={OPCOES_JANELA}
                  value={String(prefs.janela_a_vencer)}
                  onValueChange={(v) => v != null && salvar({ janela_a_vencer: Number(v) as JanelaAVencer })}
                  disabled={!prefs.a_vencer}
                >
                  <SelectTrigger id="janela" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_JANELA.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Conta a partir de hoje, inclusive.</FieldDescription>
              </Field>
            </FieldGroup>
            {salvo && (
              <p className="mt-4 text-xs text-muted-foreground" role="status">
                Salvo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Vale só neste aparelho.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Tema</FieldLabel>
              <ThemeToggle />
              <FieldDescription>Claro, escuro ou o que o sistema usar.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Menu lateral</FieldLabel>
              <SidebarModeToggle />
              <FieldDescription>
                Fixo: recolhe e expande pelo botão do menu (ou Ctrl+B). Automático: fica recolhido e expande por cima
                da tela ao passar o mouse.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

    </div>
  )
}
