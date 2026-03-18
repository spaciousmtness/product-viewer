import type { FCCEntry } from '../../lib/types'

interface Props {
  fcc: FCCEntry[] | null
}

export function RegulatoryTab({ fcc }: Props) {
  if (!fcc || fcc.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No FCC/regulatory data available
      </div>
    )
  }

  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">FCC ID</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Applicant</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Description</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Grant Date</th>
            <th className="text-left py-2 px-2 text-neutral-400 font-medium uppercase tracking-wider text-[10px]">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {fcc.map((f, i) => (
            <tr key={i} className="hover:bg-neutral-50 transition-colors">
              <td className="py-2 px-2 font-mono text-neutral-900">{f.fcc_id}</td>
              <td className="py-2 px-2 text-neutral-600">{f.applicant}</td>
              <td className="py-2 px-2 text-neutral-600 max-w-xs truncate">{f.product_description}</td>
              <td className="py-2 px-2 font-mono text-neutral-700">{f.grant_date}</td>
              <td className="py-2 px-2">
                <a
                  href={f.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
