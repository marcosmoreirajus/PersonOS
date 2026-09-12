'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type FieldConfig = {
  key: string
  label: string
}

type BusinessSectionFormProps = {
  section: string
  title: string
  fields: FieldConfig[]
}

// TODO: substituir os elementos HTML/Tailwind simples abaixo (Card, inputs)
// por componentes do design system (frontend/components/ui) quando disponíveis.
export default function BusinessSectionForm({
  section,
  title,
  fields,
}: BusinessSectionFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSection() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/business/${section}`)
        const json = await res.json()
        if (!cancelled) {
          setValues(json.data || {})
        }
      } catch (err) {
        if (!cancelled) {
          setError('Não foi possível carregar os dados da seção.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSection()

    return () => {
      cancelled = true
    }
  }, [section])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSavedAt(null)
    try {
      const res = await fetch(`${API_URL}/api/business/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      setValues(json.data || values)
      setSavedAt(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setError('Não foi possível salvar os dados da seção.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando...</p>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label htmlFor={field.key} className="text-sm font-medium text-gray-700">
              {field.label}
            </label>
            <textarea
              id={field.key}
              rows={4}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={values[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {savedAt && (
          <span className="text-sm text-gray-500">Salvo às {savedAt}</span>
        )}
      </div>
    </div>
  )
}
