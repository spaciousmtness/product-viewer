interface Props {
  specs: {
    bestbuy: Record<string, unknown> | null
    icecat: Record<string, unknown> | null
    wikipedia: Record<string, unknown> | null
  }
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else if (value != null) {
      result[fullKey] = Array.isArray(value) ? value.join(', ') : String(value)
    }
  }
  return result
}

export function SpecsTab({ specs }: Props) {
  const sources = [
    { key: 'bestbuy', label: 'Best Buy', data: specs.bestbuy },
    { key: 'icecat', label: 'ICECAT', data: specs.icecat },
    { key: 'wikipedia', label: 'Wikipedia', data: specs.wikipedia },
  ].filter(s => s.data != null) as { key: string; label: string; data: Record<string, unknown> }[]

  if (sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No spec data available
      </div>
    )
  }

  // Flatten each source and collect all keys
  const flatSources = sources.map(s => ({ ...s, flat: flattenObject(s.data) }))
  const allKeys = Array.from(new Set(flatSources.flatMap(s => Object.keys(s.flat))))

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px] sticky left-0 bg-neutral-50 z-10">Field</th>
            {flatSources.map(s => (
              <th key={s.key} className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px] min-w-[180px]">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {allKeys.map(key => {
            const values = flatSources.map(s => s.flat[key] || '')
            const allSame = values.every(v => v === values[0])
            return (
              <tr key={key} className="hover:bg-neutral-50 transition-colors">
                <td className="py-1.5 px-2 font-mono text-neutral-500 sticky left-0 bg-white z-10 border-r border-neutral-100">{key}</td>
                {values.map((v, i) => (
                  <td
                    key={i}
                    className={`py-1.5 px-2 font-mono ${
                      !v ? 'text-neutral-200' :
                      !allSame ? 'text-amber-700 bg-amber-50/50' :
                      'text-neutral-700'
                    }`}
                  >
                    {v || '--'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
