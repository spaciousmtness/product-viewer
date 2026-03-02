import { useState } from 'react'
import type { Candidate } from '../../lib/types'

interface Props {
  candidates: Candidate[]
  onSelect: (productName: string, brand: string | null) => void
  isResearch?: boolean
}

export function CandidateSelector({ candidates, onSelect, isResearch }: Props) {
  const [customMode, setCustomMode] = useState(false)
  const [customName, setCustomName] = useState('')

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-500">
        {isResearch ? 'Which product did you mean?' : 'What product is this?'}
      </div>

      <div className="space-y-3 stagger-children">
      {candidates.map((c, i) => (
        <button
          key={i}
          onClick={() => onSelect(c.productName, c.brand)}
          className="w-full text-left p-3 rounded-lg border border-neutral-200
            hover:border-neutral-400 hover:bg-neutral-50 hover:shadow-sm
            active:scale-[0.99] active:bg-neutral-100
            transition-all duration-150 group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-neutral-900 group-hover:text-neutral-900">
                {c.productName}
              </div>
              {c.brand && (
                <div className="text-xs text-neutral-500 mt-0.5">{c.brand}</div>
              )}
              <div className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {c.reasoning}
              </div>
            </div>
            <div className="flex-shrink-0">
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  c.confidence >= 0.7
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : c.confidence >= 0.3
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                }`}
              >
                {Math.round(c.confidence * 100)}%
              </span>
            </div>
          </div>
        </button>
      ))}
      </div>

      <div className="border-t border-neutral-100 pt-3">
        {!customMode ? (
          <button
            onClick={() => setCustomMode(true)}
            className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            None of these? Type the correct name...
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (customName.trim()) onSelect(customName.trim(), null)
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Daylight Computer DC-1"
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent
                placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg
                hover:bg-neutral-800 active:scale-[0.98] active:bg-neutral-950 transition-all duration-150 disabled:opacity-50"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
