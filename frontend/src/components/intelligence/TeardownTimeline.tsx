import type { TeardownDetail } from '../../lib/types'

interface Props {
  detail: TeardownDetail
  onClose: () => void
}

export function TeardownTimeline({ detail, onClose }: Props) {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-900">{detail.title}</h3>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded-full border ${
              detail.difficulty === 'Easy' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              detail.difficulty === 'Moderate' ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-red-50 border-red-200 text-red-700'
            }`}>
              {detail.difficulty}
            </span>
            <span className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-500">
              {detail.steps.length} steps
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            iFixit
          </a>
          <button
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Tools required */}
      {detail.tools_required.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1.5">Tools Required</p>
          <div className="flex flex-wrap gap-1">
            {detail.tools_required.map((t, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-600">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Steps timeline */}
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
        <div className="space-y-4">
          {detail.steps.map((step) => (
            <div key={step.step_number} className="relative pl-8">
              <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-white border-2 border-neutral-300 z-10" />
              <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400">Step {step.step_number}</span>
                  {step.title && <span className="text-xs font-medium text-neutral-800">{step.title}</span>}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">{step.text}</p>
                {step.image_url && (
                  <img
                    src={step.image_url}
                    alt={`Step ${step.step_number}`}
                    className="rounded-md max-h-48 object-contain border border-neutral-100"
                  />
                )}
                {step.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {step.tools.map((t, j) => (
                      <span key={j} className="text-[10px] px-1 py-0.5 bg-blue-50 border border-blue-200 rounded text-blue-600">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
