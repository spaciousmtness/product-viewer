import type { PatentEntry } from '../../lib/types'

interface Props {
  patents: PatentEntry[] | null
}

export function PatentsTab({ patents }: Props) {
  if (!patents || patents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No patent data available
      </div>
    )
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {patents.map((p, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2 hover:border-neutral-300 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{p.patent_number}</span>
            <span className="text-[10px] text-neutral-400 shrink-0">{p.patent_type}</span>
          </div>
          <h4 className="text-xs font-medium text-neutral-900 leading-snug line-clamp-2">{p.title}</h4>
          <p className="text-xs text-neutral-500 leading-relaxed line-clamp-3">{p.abstract}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-400">
            <span>Filed: <span className="font-mono text-neutral-600">{p.filing_date}</span></span>
            <span>Assignee: <span className="text-neutral-600">{p.assignee}</span></span>
          </div>
          {p.inventors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.inventors.map((inv, j) => (
                <span key={j} className="text-[10px] px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-500">{inv}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
