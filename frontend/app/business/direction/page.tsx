'use client'

import BusinessSectionForm from '../_components/BusinessSectionForm'

const FIELDS = [
  { key: 'mapa_do_mercado', label: 'Mapa do Mercado' },
  { key: 'mapa_de_problemas', label: 'Mapa de Problemas' },
  { key: 'perfil_ideal_de_cliente', label: 'Perfil Ideal de Cliente' },
  { key: 'tese_de_valor', label: 'Tese de Valor' },
  { key: 'oferta', label: 'Oferta' },
]

export default function DirectionPage() {
  return <BusinessSectionForm section="direction" title="Direção" fields={FIELDS} />
}
