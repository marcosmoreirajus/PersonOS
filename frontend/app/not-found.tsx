import { NotFoundStacked } from '@/components/motion/not-found/stacked'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <NotFoundStacked
        title="Página não encontrada"
        description="A página que você procura mudou de lugar, foi removida ou nunca existiu."
        tagline="fora do baralho"
        homeHref="/"
        homeLabel="Voltar ao início"
        browseHref="/finance"
        browseLabel="Ir para Finanças"
      />
    </div>
  )
}
