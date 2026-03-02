import { useState, useRef } from 'react'

interface Props {
  onSearch: (productName: string, manualFile?: File) => void
  disabled?: boolean
}

export function TextSearch({ onSearch, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [manualFile, setManualFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    onSearch(query.trim(), manualFile ?? undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-neutral-500 mb-1.5">Product name</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Konica Minolta CM-700D"
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent
            placeholder:text-neutral-400 disabled:opacity-50"
        />
        <p className="text-xs text-neutral-400 mt-1">
          Type any product — works for obscure instruments, vintage gear, anything Claude knows about.
        </p>
      </div>

      {/* Optional manual/datasheet upload */}
      <div>
        <label className="block text-xs text-neutral-500 mb-1.5">
          Manual or datasheet <span className="text-neutral-300">(optional)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
          disabled={disabled}
          className="hidden"
        />
        {manualFile ? (
          <div className="flex items-center gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded-lg">
            <span className="text-xs text-neutral-600 truncate flex-1">
              {manualFile.name}
            </span>
            <button
              type="button"
              onClick={() => { setManualFile(null); if (fileRef.current) fileRef.current.value = '' }}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="w-full py-2 text-xs text-neutral-500 border border-dashed border-neutral-300
              rounded-lg hover:border-neutral-400 hover:text-neutral-700 transition-colors
              disabled:opacity-50"
          >
            Upload PDF manual or spec sheet
          </button>
        )}
        <p className="text-xs text-neutral-400 mt-1">
          Claude reads the manual and extracts exact specs — dimensions, tolerances, interfaces.
        </p>
      </div>

      <button
        type="submit"
        disabled={disabled || !query.trim()}
        className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg
          hover:bg-neutral-800 active:scale-[0.98] active:bg-neutral-950 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Research product
      </button>
    </form>
  )
}
