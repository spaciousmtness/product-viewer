import type { ComponentEntry } from '../../lib/types'

interface Props {
  components: ComponentEntry[] | null
}

export function ComponentsTab({ components }: Props) {
  if (!components || components.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No component data available
      </div>
    )
  }

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">MPN</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Manufacturer</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Description</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Price</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Links</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {components.map((c, i) => (
            <tr key={i} className="hover:bg-neutral-50 transition-colors">
              <td className="py-2 px-2 font-mono text-neutral-900">{c.mpn}</td>
              <td className="py-2 px-2 text-neutral-600">{c.manufacturer}</td>
              <td className="py-2 px-2 text-neutral-600 max-w-xs truncate">{c.description}</td>
              <td className="py-2 px-2 font-mono text-neutral-700">
                {c.pricing.length > 0 ? (
                  <span>{c.pricing[0].currency} {c.pricing[0].price.toFixed(2)}</span>
                ) : (
                  <span className="text-neutral-300">--</span>
                )}
              </td>
              <td className="py-2 px-2">
                <div className="flex gap-2">
                  {c.datasheet_url && (
                    <a
                      href={c.datasheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-800 underline"
                    >
                      Datasheet
                    </a>
                  )}
                  {c.octopart_url && (
                    <a
                      href={c.octopart_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Octopart
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Expanded specs for each component */}
      <div className="mt-4 space-y-3">
        {components.filter(c => Object.keys(c.specs).length > 0).map((c, i) => (
          <details key={i} className="rounded-lg border border-neutral-200 bg-white">
            <summary className="px-3 py-2 text-xs font-medium text-neutral-700 cursor-pointer hover:bg-neutral-50">
              {c.mpn} — {Object.keys(c.specs).length} specs
            </summary>
            <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {Object.entries(c.specs).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-neutral-400">{k}</span>
                  <span className="text-neutral-700 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
