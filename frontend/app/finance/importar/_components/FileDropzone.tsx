'use client'

import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'

import { cn } from '@/lib/utils'

const ACEITOS = '.ofx,.qfx,.csv,.txt,.xlsx'

/** Área de soltar arquivo (HTML5 nativo, sem biblioteca). */
export function FileDropzone({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          ref.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSobre(false)
        onFile(e.dataTransfer.files?.[0] ?? null)
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring',
        sobre && 'bg-muted/60',
      )}
    >
      <FileUp className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      {file ? (
        <p className="text-sm font-medium text-foreground">{file.name}</p>
      ) : (
        <p className="text-sm text-foreground">Arraste o arquivo aqui ou clique para escolher</p>
      )}
      <p className="text-xs text-muted-foreground">OFX, CSV ou XLSX · até 5 MB</p>
      <input
        ref={ref}
        type="file"
        accept={ACEITOS}
        className="sr-only"
        tabIndex={-1}
        aria-label="Arquivo do extrato"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
