# Briefing — Módulo Negócio (PersonOS)

## O que é

O módulo Negócio é o segundo pilar do PersonOS (ao lado do módulo Finanças). Enquanto Finanças organiza o dinheiro do dia a dia, Negócio organiza o **pensamento estratégico** de quem toca um empreendimento: quem é o fundador, para onde o negócio está indo, o que já foi validado no mercado e como está o caixa da empresa.

Na prática, é um espaço estruturado de 4 páginas onde o dono do negócio escreve — em texto livre, mas guiado por campos com propósito claro — as respostas para as perguntas que todo empreendedor deveria revisitar com frequência e raramente tem em um lugar só: qual é o meu objetivo, quem é meu cliente ideal, o que já vendi, como está meu fluxo de caixa.

## Para quem é

- Donos de pequenos negócios e microempreendedores.
- Freelancers com CNPJ que tratam o próprio trabalho como empresa.
- Empreendedores em fase de validação (early-stage), que precisam de clareza estratégica mais do que de ferramentas complexas de gestão.

Não é voltado para empresas com múltiplos sócios, times grandes ou necessidade de colaboração multiusuário — isso pode vir em fases futuras, mas não é o alvo do MVP.

## Qual problema resolve

Hoje esse tipo de reflexão estratégica fica espalhada: um pouco em notas soltas, um pouco na cabeça, um pouco em planilhas de curso. O módulo Negócio resolve dois problemas:

1. **Curto prazo:** dar um lugar único e simples para registrar o raciocínio estratégico do negócio (fundador, direção de mercado, validação e caixa), sem exigir ferramentas de gestão empresarial completas.
2. **Longo prazo (preparação):** estruturar esses dados desde já em um formato que agentes de IA vão poder ler e escrever depois, para ajudar ativamente na tomada de decisão — sugerindo ajustes de oferta, lendo o histórico de validação, cruzando caixa com metas, etc. O MVP não implementa isso ainda, mas o formato de dados é desenhado pensando nisso desde o início.

## Relação com o módulo Finanças

Negócio e Finanças são **módulos irmãos, não módulo e submódulo**. Isso é uma decisão de arquitetura, não só de produto:

- Dados separados: Finanças usa seus próprios arquivos/rotas; Negócio terá os seus, sem tabelas ou modelos compartilhados.
- Sem dependência cruzada: o módulo Negócio não lê nem escreve dados do módulo Finanças (e vice-versa) nesta fase. Se no futuro fizer sentido cruzar informação (ex.: caixa do negócio informando o dashboard financeiro pessoal), isso será uma integração explícita, não um acoplamento estrutural.
- Motivo: a visão de produto do PersonOS inclui vender os módulos como SKUs separados (só Finanças, só Negócio, ou o pacote completo). Um módulo não pode depender do outro para funcionar.

## Filosofia de dados

Assim como o restante do PersonOS nesta fase, o módulo Negócio não usa banco de dados relacional. Cada página de conteúdo é persistida como um arquivo **Markdown com frontmatter YAML**, guardado em disco (`data/business/*.md`).

Por quê:

- **Simplicidade first:** nada de schema, migração ou ORM para um MVP que ainda está validando a UX. O backend FastAPI só lê e escreve esses arquivos diretamente.
- **Legibilidade humana:** o próprio Marco (ou qualquer usuário) pode abrir o arquivo `.md` num editor de texto ou no Obsidian e entender/editar o conteúdo sem depender da interface.
- **Pronto para IA:** Markdown + frontmatter é o formato mais natural para um agente de IA ler contexto e escrever de volta (sem precisar de API de banco de dados, sem serialização complexa). Isso é uma preparação deliberada para a fase futura em que agentes vão interagir com esses dados — não uma feature em si do MVP.

Essa filosofia é a mesma que orienta o restante do PersonOS nesta fase: pragmatismo, sem over-engineering, incremental.
