import { useState, useEffect, useCallback } from 'react'
import { api2 } from '../../lib/api'
import type { Annotation, AnnotationData } from '../../lib/types'

interface Props {
  slug: string
  active: boolean
  onToggle: () => void
}

const ANNOTATION_TYPES = [
  { type: 'note' as const, label: 'Note', color: 'bg-blue-500' },
  { type: 'measurement' as const, label: 'Measurement', color: 'bg-emerald-500' },
  { type: 'flag' as const, label: 'Flag', color: 'bg-red-500' },
  { type: 'spec_ref' as const, label: 'Spec Ref', color: 'bg-purple-500' },
]

export function AnnotationLayer({ slug, active, onToggle }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedType, setSelectedType] = useState<AnnotationData['type']>('note')
  const [placing, setPlacing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const loadAnnotations = useCallback(async () => {
    try {
      const result = await api2.getAnnotations(slug)
      setAnnotations(result.annotations)
    } catch {
      // annotations may not exist yet
    }
  }, [slug])

  useEffect(() => {
    if (slug) loadAnnotations()
  }, [slug, loadAnnotations])

  const handleViewerClick = useCallback(async (e: MouseEvent) => {
    if (!placing || !active) return
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    try {
      const annotation = await api2.createAnnotation(slug, {
        type: selectedType,
        x,
        y,
        text: `New ${selectedType}`,
        value: '',
      })
      setAnnotations(prev => [...prev, annotation])
      setPlacing(false)
    } catch {
      // creation failed
    }
  }, [placing, active, slug, selectedType])

  useEffect(() => {
    if (!active || !placing) return
    const viewer = document.querySelector('[data-viewer-area]') as HTMLElement | null
    if (!viewer) return

    viewer.addEventListener('click', handleViewerClick)
    viewer.style.cursor = 'crosshair'
    return () => {
      viewer.removeEventListener('click', handleViewerClick)
      viewer.style.cursor = ''
    }
  }, [active, placing, handleViewerClick])

  const handleDelete = async (annotationId: string) => {
    try {
      await api2.deleteAnnotation(slug, annotationId)
      setAnnotations(prev => prev.filter(a => a.id !== annotationId))
    } catch {
      // delete failed
    }
  }

  const handleUpdate = async (annotationId: string) => {
    try {
      const updated = await api2.updateAnnotation(slug, annotationId, { text: editText })
      setAnnotations(prev => prev.map(a => a.id === annotationId ? updated : a))
      setEditingId(null)
    } catch {
      // update failed
    }
  }

  const getColor = (type: string) => {
    return ANNOTATION_TYPES.find(t => t.type === type)?.color ?? 'bg-neutral-500'
  }

  return (
    <div className="space-y-3">
      {/* Toggle + controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            active
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
          }`}
        >
          {active ? 'Annotations ON' : 'Annotations'}
        </button>
      </div>

      {active && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-3">
          {/* Type selector + place button */}
          <div className="flex items-center gap-2">
            {ANNOTATION_TYPES.map(({ type, label, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  selectedType === type
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPlacing(!placing)}
            className={`w-full py-1.5 text-xs rounded-lg border transition-colors ${
              placing
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {placing ? 'Click on viewer to place...' : 'Place annotation'}
          </button>

          {/* Annotations list */}
          {annotations.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {annotations.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-neutral-50 group">
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${getColor(a.type)}`} />
                  <div className="flex-1 min-w-0">
                    {editingId === a.id ? (
                      <div className="flex gap-1">
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdate(a.id) }}
                          className="flex-1 text-xs border border-neutral-300 rounded px-1.5 py-0.5"
                          autoFocus
                        />
                        <button onClick={() => handleUpdate(a.id)} className="text-emerald-600 text-[10px]">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-neutral-400 text-[10px]">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-neutral-700">{a.text}</span>
                        <span className="text-[10px] text-neutral-300 ml-1">({a.x.toFixed(0)}, {a.y.toFixed(0)})</span>
                      </>
                    )}
                  </div>
                  {editingId !== a.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(a.id); setEditText(a.text) }}
                        className="text-[10px] text-neutral-400 hover:text-neutral-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-[10px] text-red-400 hover:text-red-600"
                      >
                        Del
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {annotations.length === 0 && (
            <p className="text-[10px] text-neutral-400 text-center py-2">No annotations yet</p>
          )}
        </div>
      )}

      {/* Annotation pins overlay */}
      {active && annotations.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-20">
          {annotations.map(a => (
            <div
              key={a.id}
              className="absolute pointer-events-auto"
              style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -100%)' }}
              title={a.text}
            >
              <div className={`w-4 h-4 rounded-full ${getColor(a.type)} border-2 border-white shadow-md cursor-pointer`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
