import { useState } from 'react'
import { EXPORT_PRESETS } from '../../lib/types'
import type { BackgroundMode } from '../../lib/types'

interface Props {
  onExport: (settings: {
    width: number
    height: number
    format: 'png' | 'jpeg'
    quality: number
    transparent: boolean
    background: BackgroundMode
  }) => Promise<void>
  disabled?: boolean
  modelUrl?: string
  productName?: string
  onExportSTL?: () => void
  onExportGLB?: () => void
  onDownloadOriginal?: () => void
}

export function ExportPanel({
  onExport,
  disabled,
  modelUrl,
  onExportSTL,
  onExportGLB,
  onDownloadOriginal,
}: Props) {
  const [preset, setPreset] = useState('4K')
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [transparent, setTransparent] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const p = EXPORT_PRESETS[preset]
    if (!p) return
    setExporting(true)
    try {
      await onExport({
        width: p.width,
        height: p.height,
        format,
        quality: 0.92,
        transparent: format === 'png' && transparent,
        background: transparent ? 'transparent' : 'gradient',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Image export */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Export Image</h3>

        {/* Resolution */}
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-500 font-medium">Resolution</label>
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(EXPORT_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`text-xs py-1.5 rounded-md border transition-colors
                  ${preset === key
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  }
                `}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 font-mono">
            {EXPORT_PRESETS[preset]?.width} x {EXPORT_PRESETS[preset]?.height}
          </p>
        </div>

        {/* Format */}
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-500 font-medium">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('png')}
              className={`flex-1 text-xs py-1.5 rounded-md border transition-colors
                ${format === 'png'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                }
              `}
            >
              PNG
            </button>
            <button
              onClick={() => setFormat('jpeg')}
              className={`flex-1 text-xs py-1.5 rounded-md border transition-colors
                ${format === 'jpeg'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                }
              `}
            >
              JPEG
            </button>
          </div>
        </div>

        {/* Transparent background (PNG only) */}
        {format === 'png' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-neutral-300"
            />
            <span className="text-xs text-neutral-600">Transparent background</span>
          </label>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={disabled || exporting}
          className="w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg
            hover:bg-neutral-800 active:scale-[0.98] active:bg-neutral-950 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export Image'}
        </button>
      </div>

      {/* 3D model export */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Download 3D</h3>
        <p className="text-xs text-neutral-400">
          STL for 3D printing, GLB for editing in Blender or other tools.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportSTL}
            disabled={disabled}
            className="py-2 text-xs font-medium rounded-lg border border-neutral-200
              text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download STL
          </button>
          <button
            onClick={onExportGLB}
            disabled={disabled}
            className="py-2 text-xs font-medium rounded-lg border border-neutral-200
              text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download GLB
          </button>
        </div>

        {modelUrl && (
          <button
            onClick={onDownloadOriginal}
            disabled={disabled}
            className="w-full py-1.5 text-xs text-neutral-500 hover:text-neutral-700 underline transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download original from Tripo
          </button>
        )}
      </div>
    </div>
  )
}
