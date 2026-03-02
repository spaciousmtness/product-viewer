import { useState, useCallback, useEffect, useRef } from 'react'

interface Props {
  onImageSelected: (file: File) => void
  onUrlSubmitted: (url: string) => void
  disabled?: boolean
}

export function DropZone({ onImageSelected, onUrlSubmitted, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Clipboard paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (disabled) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) onImageSelected(file)
          return
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onImageSelected, disabled])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        onImageSelected(file)
        return
      }

      // Check for dropped URL
      const text = e.dataTransfer.getData('text/plain')
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        onUrlSubmitted(text)
      }
    },
    [onImageSelected, onUrlSubmitted, disabled]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onImageSelected(file)
    },
    [onImageSelected]
  )

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (urlValue.trim()) {
        onUrlSubmitted(urlValue.trim())
        setUrlValue('')
      }
    },
    [urlValue, onUrlSubmitted]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && !urlMode && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging ? 'border-neutral-900 bg-neutral-100 shadow-inner' : 'border-neutral-300 hover:border-neutral-400 hover:shadow-inner'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="space-y-3">
        <div className="text-neutral-400">
          <svg
            className="mx-auto w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </div>

        <div>
          <p className="text-sm text-neutral-600 font-medium">
            Drop an image, paste from clipboard, or click to browse
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            PNG, JPG, WebP, HEIC
          </p>
        </div>

        <div className="flex items-center gap-2 justify-center">
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-400">or</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        {urlMode ? (
          <form onSubmit={handleUrlSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://..."
                className="flex-1 text-sm px-3 py-1.5 border border-neutral-300 rounded-md
                  focus:outline-none focus:ring-1 focus:ring-neutral-400"
                autoFocus
              />
              <button
                type="submit"
                className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded-md
                  hover:bg-neutral-800 active:scale-[0.98] active:bg-neutral-950 transition-all duration-150"
              >
                Load
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setUrlMode(true)
            }}
            className="text-xs text-neutral-500 hover:text-neutral-700 underline transition-colors"
          >
            Enter image URL
          </button>
        )}
      </div>
    </div>
  )
}
