import type { BackgroundMode } from '../../lib/types'

interface Props {
  background: BackgroundMode
  onBackgroundChange: (mode: BackgroundMode) => void
  onResetCamera: () => void
  onCameraPreset: (preset: 'front' | 'quarter' | 'top' | 'detail') => void
}

const BACKGROUNDS: { mode: BackgroundMode; label: string; icon: string }[] = [
  { mode: 'gradient', label: 'Gradient', icon: '◐' },
  { mode: 'white', label: 'White', icon: '○' },
  { mode: 'studio', label: 'Studio', icon: '◉' },
  { mode: 'transparent', label: 'None', icon: '◌' },
]

const CAMERA_PRESETS: { preset: 'front' | 'quarter' | 'top' | 'detail'; label: string }[] = [
  { preset: 'front', label: 'Front' },
  { preset: 'quarter', label: '3/4' },
  { preset: 'top', label: 'Top' },
  { preset: 'detail', label: 'Detail' },
]

export function ViewerControls({
  background,
  onBackgroundChange,
  onResetCamera,
  onCameraPreset,
}: Props) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
      {/* Camera presets */}
      <div className="flex bg-white/90 backdrop-blur-sm rounded-lg border border-neutral-200 overflow-hidden">
        {CAMERA_PRESETS.map(({ preset, label }) => (
          <button
            key={preset}
            onClick={() => onCameraPreset(preset)}
            className="px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100
              active:scale-95 transition-all duration-100 border-r border-neutral-200 last:border-r-0"
            title={label}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Background toggle */}
      <div className="flex bg-white/90 backdrop-blur-sm rounded-lg border border-neutral-200 overflow-hidden">
        {BACKGROUNDS.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => onBackgroundChange(mode)}
            className={`px-2.5 py-1.5 text-xs transition-all duration-100 border-r border-neutral-200 last:border-r-0
              active:scale-95
              ${background === mode ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}
            `}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Reset button */}
      <button
        onClick={onResetCamera}
        className="px-2.5 py-1.5 text-xs bg-white/90 backdrop-blur-sm rounded-lg
          border border-neutral-200 text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-all duration-100"
        title="Reset view (R)"
      >
        Reset
      </button>
    </div>
  )
}
