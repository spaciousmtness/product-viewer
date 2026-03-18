import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface CatalogProduct {
  slug: string
  name: string
  brand?: string
  recognition?: Record<string, unknown>
}

export function ComparisonView() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listCatalog()
      .then(res => {
        const products = (res.products || []).map((p: Record<string, unknown>) => ({
          slug: p.slug as string,
          name: (p.recognition as Record<string, unknown>)?.productName as string ?? p.slug as string,
          brand: (p.recognition as Record<string, unknown>)?.brand as string | undefined,
          recognition: p.recognition as Record<string, unknown> | undefined,
        }))
        setCatalog(products)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleProduct = (slug: string) => {
    setSelected(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 3 ? [...prev, slug] : prev
    )
  }

  const selectedProducts = catalog.filter(p => selected.includes(p.slug))

  // Extract comparison fields
  const getFields = (recog: Record<string, unknown> | undefined): Record<string, string> => {
    if (!recog) return {}
    const fields: Record<string, string> = {}
    const keys = ['category', 'formFactor', 'dimensions', 'weight', 'materials', 'interfaces',
      'modelNumber', 'yearRange', 'msrpAtRelease', 'currentValue', 'manufacturingOrigin']
    for (const k of keys) {
      const v = recog[k]
      if (v != null) {
        fields[k] = Array.isArray(v) ? v.join(', ') : String(v)
      }
    }
    return fields
  }

  const allFieldKeys = Array.from(new Set(selectedProducts.flatMap(p => Object.keys(getFields(p.recognition)))))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        Loading catalog...
      </div>
    )
  }

  if (catalog.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        Save at least 2 products to catalog to compare
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Product selector */}
      <div>
        <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Select products to compare (max 3)</p>
        <div className="flex flex-wrap gap-2">
          {catalog.map(p => (
            <button
              key={p.slug}
              onClick={() => toggleProduct(p.slug)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                selected.includes(p.slug)
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {p.name}
              {p.brand && <span className="text-neutral-400 ml-1">({p.brand})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      {selectedProducts.length >= 2 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Field</th>
                {selectedProducts.map(p => (
                  <th key={p.slug} className="text-left py-2 px-2 text-neutral-700 font-medium text-[10px] min-w-[150px]">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {allFieldKeys.map(key => {
                const vals = selectedProducts.map(p => getFields(p.recognition)[key] || '')
                const allSame = vals.every(v => v === vals[0])
                return (
                  <tr key={key} className="hover:bg-neutral-50">
                    <td className="py-1.5 px-2 text-neutral-500 font-mono">{key}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`py-1.5 px-2 font-mono ${
                        !v ? 'text-neutral-200' :
                        !allSame ? 'text-amber-700 bg-amber-50/50' :
                        'text-neutral-700'
                      }`}>
                        {v || '--'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
