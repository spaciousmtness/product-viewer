import { useState } from 'react'
import type { TeardownEntry, TeardownDetail } from '../../lib/types'
import { api2 } from '../../lib/api'
import { TeardownTimeline } from './TeardownTimeline'

interface Props {
  teardowns: TeardownEntry[] | null
}

export function TeardownsTab({ teardowns }: Props) {
  const [detail, setDetail] = useState<TeardownDetail | null>(null)
  const [loading, setLoading] = useState(false)

  if (detail) {
    return <TeardownTimeline detail={detail} onClose={() => setDetail(null)} />
  }

  if (!teardowns || teardowns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No teardown data available
      </div>
    )
  }

  const handleOpenDetail = async (guideId: number) => {
    setLoading(true)
    try {
      const d = await api2.getTeardownDetail(guideId)
      setDetail(d)
    } catch {
      // Fall back to not showing detail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {teardowns.map((t, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white overflow-hidden hover:border-neutral-300 transition-colors">
          {t.image_url && (
            <img
              src={t.image_url}
              alt={t.title}
              className="w-full h-32 object-cover border-b border-neutral-100"
            />
          )}
          <div className="p-3 space-y-2">
            <h4 className="text-xs font-medium text-neutral-900 leading-snug line-clamp-2">{t.title}</h4>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded-full border ${
                t.difficulty === 'Easy' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                t.difficulty === 'Moderate' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-red-50 border-red-200 text-red-700'
              }`}>
                {t.difficulty}
              </span>
              <span className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-full text-neutral-500">
                {t.steps_count} steps
              </span>
            </div>
            {t.tools_required.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.tools_required.slice(0, 4).map((tool, j) => (
                  <span key={j} className="text-[10px] px-1 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-500">{tool}</span>
                ))}
                {t.tools_required.length > 4 && (
                  <span className="text-[10px] text-neutral-400">+{t.tools_required.length - 4} more</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleOpenDetail(t.guide_id)}
                disabled={loading}
                className="text-xs text-emerald-600 hover:text-emerald-800 underline disabled:opacity-50"
              >
                View steps
              </button>
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                iFixit
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
