import { useState, useCallback, useRef } from 'react'
import type { ViewAngle, AngleImage } from '../../lib/types'

const ANGLES: { key: ViewAngle; label: string; icon: string }[] = [
  { key: 'front', label: 'Front', icon: '正' },
  { key: 'left', label: 'Left', icon: '左' },
  { key: 'back', label: 'Back', icon: '背' },
  { key: 'right', label: 'Right', icon: '右' },
]

interface Props {
  images: AngleImage[]
  onImagesChange: (images: AngleImage[]) => void
  disabled?: boolean
}

export function MultiImageUpload({ images, onImagesChange, disabled }: Props) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const setImage = useCallback(
    (angle: ViewAngle, file: File) => {
      const previewUrl = URL.createObjectURL(file)
      const existing = images.filter((img) => img.angle !== angle)
      onImagesChange([...existing, { file, previewUrl, angle }])
    },
    [images, onImagesChange]
  )

  const removeImage = useCallback(
    (angle: ViewAngle) => {
      const img = images.find((i) => i.angle === angle)
      if (img) URL.revokeObjectURL(img.previewUrl)
      onImagesChange(images.filter((i) => i.angle !== angle))
    },
    [images, onImagesChange]
  )

  const handleDrop = useCallback(
    (angle: ViewAngle) => (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        setImage(angle, file)
      }
    },
    [setImage, disabled]
  )

  const handleFileInput = useCallback(
    (angle: ViewAngle) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) setImage(angle, file)
    },
    [setImage]
  )

  const hasFront = images.some((i) => i.angle === 'front')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">
          Multi-angle images
        </p>
        <span className="text-xs text-neutral-400">
          {images.length}/4 angles
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ANGLES.map(({ key, label, icon }) => {
          const img = images.find((i) => i.angle === key)
          const isRequired = key === 'front'

          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={handleDrop(key)}
              onClick={() => !disabled && !img && inputRefs.current[key]?.click()}
              className={`
                relative rounded-lg overflow-hidden cursor-pointer
                transition-all duration-200 aspect-square
                ${img
                  ? 'border-2 border-neutral-900'
                  : isRequired
                    ? 'border-2 border-dashed border-neutral-400 hover:border-neutral-600 bg-neutral-50'
                    : 'border-2 border-dashed border-neutral-200 hover:border-neutral-400 bg-neutral-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                ref={(el) => { inputRefs.current[key] = el }}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleFileInput(key)}
                className="hidden"
              />

              {img ? (
                <>
                  <img
                    src={img.previewUrl}
                    alt={`${label} view`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage(key)
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white
                      flex items-center justify-center text-xs hover:bg-black/80"
                  >
                    x
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                  <span className="text-lg text-neutral-300">{icon}</span>
                  <span className="text-xs text-neutral-400">+</span>
                </div>
              )}

              {/* Label badge */}
              <div
                className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-center
                  ${img ? 'bg-black/50' : 'bg-neutral-100'}
                `}
              >
                <span className={`text-xs font-medium ${img ? 'text-white' : 'text-neutral-500'}`}>
                  {label}
                  {isRequired && !img && (
                    <span className="text-amber-500 ml-1">*</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {!hasFront && (
        <p className="text-xs text-amber-600">
          Front view is required. Other angles are optional but improve quality.
        </p>
      )}

      {images.length > 0 && (
        <p className="text-xs text-neutral-400">
          {images.length === 1
            ? 'Single image mode. Add more angles for better 3D reconstruction.'
            : `${images.length} angles will be used for multi-view reconstruction.`}
        </p>
      )}
    </div>
  )
}
