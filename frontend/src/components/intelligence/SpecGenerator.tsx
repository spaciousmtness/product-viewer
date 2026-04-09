import { useState } from 'react'
import { api2 } from '../../lib/api'
import type { IntelligenceResult, RecognitionResult } from '../../lib/types'

interface Props {
  intelligence: IntelligenceResult | null
  recognition: RecognitionResult | null
}

const SECTIONS = [
  { key: 'dimensions', label: 'Dimensions & Weight' },
  { key: 'materials', label: 'Materials' },
  { key: 'components', label: 'Components (BOM)' },
  { key: 'regulatory', label: 'FCC/Regulatory' },
  { key: 'patents', label: 'Patents' },
  { key: 'teardowns', label: 'Teardown/Assembly' },
  { key: 'specs', label: 'Specifications' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

export function SpecGenerator({ intelligence, recognition }: Props) {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    dimensions: true,
    materials: true,
    components: true,
    regulatory: true,
    patents: true,
    teardowns: true,
    specs: true,
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string>()

  const toggleSection = (key: SectionKey) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasSectionData = (key: SectionKey): boolean => {
    if (!intelligence) return false
    switch (key) {
      case 'dimensions': return !!(recognition?.dimensions || recognition?.weight)
      case 'materials': return intelligence.materials.length > 0
      case 'components': return (intelligence.components?.length ?? 0) > 0
      case 'regulatory': return (intelligence.fcc?.length ?? 0) > 0
      case 'patents': return (intelligence.patents?.length ?? 0) > 0
      case 'teardowns': return (intelligence.teardowns?.length ?? 0) > 0
      case 'specs': return !!(intelligence.specs.bestbuy || intelligence.specs.icecat || intelligence.specs.wikipedia)
    }
  }

  const handleGenerate = async () => {
    if (!recognition) return
    setGenerating(true)
    setError(undefined)
    try {
      const blob = await api2.generateSpecPackage({
        product_name: recognition.productName,
        brand: recognition.brand ?? undefined,
        recognition: recognition as unknown as Record<string, unknown>,
        intelligence: intelligence as unknown as Record<string, unknown> ?? undefined,
        sections,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${recognition.productName.replace(/\s+/g, '_')}_spec_package.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate spec package')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">Generate Spec Package</h3>
      <p className="text-xs text-neutral-400">Select sections to include in the manufacturing spec PDF.</p>

      <div className="space-y-1.5">
        {SECTIONS.map(({ key, label }) => {
          const hasData = hasSectionData(key)
          return (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggleSection(key)}
                disabled={!hasData}
                className="w-3.5 h-3.5 rounded border-neutral-300 disabled:opacity-40"
              />
              <span className={`text-xs ${hasData ? 'text-neutral-700' : 'text-neutral-300'}`}>{label}</span>
              {!hasData && <span className="text-[10px] text-neutral-300">(no data)</span>}
            </label>
          )
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || !recognition}
        className="w-full py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
          hover:bg-emerald-700 active:scale-[0.98] transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? 'Generating PDF...' : 'Generate Manufacturing Spec'}
      </button>
    </div>
  )
}
