'use client'

import BusinessSectionForm from '../_components/BusinessSectionForm'

const FIELDS = [
  { key: 'oferta', label: 'Oferta' },
  { key: 'primeiros_clientes', label: 'Primeiros Clientes' },
]

export default function ValidationPage() {
  return <BusinessSectionForm section="validation" title="Validação" fields={FIELDS} />
}
