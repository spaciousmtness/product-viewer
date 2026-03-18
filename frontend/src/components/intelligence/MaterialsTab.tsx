import type { MaterialEntry } from '../../lib/types'

interface Props {
  materials: MaterialEntry[]
}

export function MaterialsTab({ materials }: Props) {
  if (materials.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
        No material data available
      </div>
    )
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {materials.map((m, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-xs font-semibold text-neutral-900">{m.name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded-full text-neutral-500 shrink-0">{m.material_type}</span>
          </div>
          {m.grade && (
            <div className="text-[10px] text-neutral-400">
              Grade: <span className="font-mono text-neutral-600">{m.grade}</span>
            </div>
          )}
          <div className="space-y-1 text-xs">
            {m.density && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Density</span>
                <span className="text-neutral-700 font-mono">{m.density}</span>
              </div>
            )}
            {m.tensile_strength && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Tensile Strength</span>
                <span className="text-neutral-700 font-mono">{m.tensile_strength}</span>
              </div>
            )}
          </div>
          {m.thermal_properties && Object.keys(m.thermal_properties).length > 0 && (
            <div className="border-t border-neutral-100 pt-2 space-y-1">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Thermal</p>
              {Object.entries(m.thermal_properties).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-neutral-400">{k}</span>
                  <span className="text-neutral-700 font-mono">{v}</span>
                </div>
              ))}
            </div>
          )}
          {m.common_applications.length > 0 && (
            <div className="border-t border-neutral-100 pt-2">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Applications</p>
              <div className="flex flex-wrap gap-1">
                {m.common_applications.map((a, j) => (
                  <span key={j} className="text-[10px] px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-500">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
