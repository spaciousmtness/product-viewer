import type { RecognitionResult } from '../../lib/types'

interface Props {
  imageUrl: string
  recognition: RecognitionResult | null
  onReset: () => void
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-neutral-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-neutral-700 text-right">{value}</span>
    </div>
  )
}

export function ImagePreview({ imageUrl, recognition, onReset }: Props) {
  return (
    <div className="space-y-3">
      <div className="relative group">
        <img
          src={imageUrl}
          alt="Uploaded product"
          className="w-full rounded-lg object-cover max-h-48"
        />
        <button
          onClick={onReset}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white
            flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
            transition-opacity hover:bg-black/80"
        >
          ×
        </button>
      </div>

      {recognition && (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">
              {recognition.productName}
            </h3>
            {recognition.brand && (
              <p className="text-xs text-neutral-500 mt-0.5">{recognition.brand}</p>
            )}
          </div>

          {/* Tags */}
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
            <span className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
              {recognition.category}
            </span>
            {recognition.subcategory && recognition.subcategory !== recognition.category && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 rounded-full text-blue-700">
                {recognition.subcategory}
              </span>
            )}
            {recognition.yearRange && (
              <span className="text-xs px-2 py-0.5 bg-amber-50 rounded-full text-amber-700">
                {recognition.yearRange}
              </span>
            )}
            {recognition.colorway && (
              <span className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                {recognition.colorway}
              </span>
            )}
            {recognition.condition && (
              <span className="text-xs px-2 py-0.5 bg-emerald-50 rounded-full text-emerald-700">
                {recognition.condition}
              </span>
            )}
          </div>

          {/* Dossier details */}
          <div className="px-3 py-2 space-y-1.5">
            <Detail label="Model" value={recognition.modelNumber} />
            <Detail label="Released" value={recognition.releaseYear?.toString()} />
            <Detail label="MSRP" value={recognition.msrpAtRelease} />
            <Detail label="Value now" value={recognition.currentValue} />
            <Detail label="Dimensions" value={recognition.dimensions} />
            <Detail label="Weight" value={recognition.weight} />
            <Detail label="Origin" value={recognition.manufacturingOrigin} />
          </div>

          {/* Technical specs (for instruments) */}
          {recognition.technicalSpecs && (
            <div className="px-3 py-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 mb-1">Technical specs</p>
              <p className="text-xs text-neutral-600 font-mono leading-relaxed">
                {recognition.technicalSpecs}
              </p>
            </div>
          )}

          {/* Interfaces */}
          {recognition.interfaces && recognition.interfaces.length > 0 && (
            <div className="px-3 py-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 mb-1">Interfaces</p>
              <div className="flex flex-wrap gap-1">
                {recognition.interfaces.map((iface, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-600"
                  >
                    {iface}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {recognition.materials && recognition.materials.length > 0 && (
            <div className="px-3 py-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 mb-1">Materials</p>
              <div className="flex flex-wrap gap-1">
                {recognition.materials.map((m, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-600"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          {recognition.features.length > 0 && (
            <div className="px-3 py-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 mb-1">Key features</p>
              <div className="flex flex-wrap gap-1">
                {recognition.features.map((f, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-600"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cultural note */}
          {recognition.culturalNote && (
            <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50">
              <p className="text-xs text-neutral-500 italic leading-relaxed">
                {recognition.culturalNote}
              </p>
            </div>
          )}

          {/* Form factor */}
          <div className="px-3 py-2 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">{recognition.formFactor}</p>
          </div>
        </div>
      )}
    </div>
  )
}
