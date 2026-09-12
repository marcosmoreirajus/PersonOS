'use client'

import BusinessSectionForm from '../_components/BusinessSectionForm'

const FIELDS = [
  { key: 'fluxo_de_caixa', label: 'Fluxo de Caixa' },
  { key: 'erp', label: 'ERP' },
]

export default function CaixaPage() {
  return <BusinessSectionForm section="caixa" title="Caixa" fields={FIELDS} />
}
