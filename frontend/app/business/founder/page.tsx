'use client'

import BusinessSectionForm from '../_components/BusinessSectionForm'

const FIELDS = [
  { key: 'objetivo', label: 'Objetivo' },
  { key: 'estilo_de_vida', label: 'Estilo de vida' },
]

export default function FounderPage() {
  return <BusinessSectionForm section="founder" title="Founder" fields={FIELDS} />
}
