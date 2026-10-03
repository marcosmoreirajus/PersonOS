import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Config "flat" do ESLint 9, no formato da doc do Next 16 (o `next lint` foi
// removido nessa versão — era o que deixava `npm run lint` quebrado).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Código copiado do registry beUI (1ª linha de cada arquivo): segue o
    // upstream em vez de ser reescrito para o lint. Estas regras disparam lá;
    // ao atualizar um componente, rodar `npx eslint components/motion` e
    // reajustar a lista. Extensões locais (ex.: `expandOnHover` na
    // animated-sidebar) continuam valendo para as outras regras.
    files: ['components/motion/**'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
