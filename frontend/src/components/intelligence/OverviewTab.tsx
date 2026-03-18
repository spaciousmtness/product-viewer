import type { IntelligenceResult } from '../../lib/types'

interface Props {
  data: IntelligenceResult
}

export function OverviewTab({ data }: Props) {
  const { meta } = data
  const dataQuality = meta.total_sources > 0
    ? Math.round((meta.sources_with_data.length / meta.total_sources) * 100)
    : 0

  return (
    <div className="space-y-4 p-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Sources</p>
          <p className="text-lg font-semibold text-neutral-900 font-mono">{meta.sources_with_data.length}/{meta.total_sources}</p>
          <p className="text-xs text-neutral-500">returned data</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Elapsed</p>
          <p className="text-lg font-semibold text-neutral-900 font-mono">{(meta.elapsed_ms / 1000).toFixed(1)}s</p>
          <p className="text-xs text-neutral-500">pipeline time</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Quality</p>
          <p className={`text-lg font-semibold font-mono ${dataQuality >= 70 ? 'text-emerald-600' : dataQuality >= 40 ? 'text-amber-600' : 'text-neutral-400'}`}>
            {dataQuality}%
          </p>
          <p className="text-xs text-neutral-500">data coverage</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Errors</p>
          <p className={`text-lg font-semibold font-mono ${meta.errors.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {meta.errors.length}
          </p>
          <p className="text-xs text-neutral-500">failed sources</p>
        </div>
      </div>

      {/* Query info */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Query</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-400">Product</span>
            <span className="text-neutral-700 font-mono">{data.query.product_name}</span>
          </div>
          {data.query.brand && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Brand</span>
              <span className="text-neutral-700 font-mono">{data.query.brand}</span>
            </div>
          )}
          {data.query.model_number && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Model</span>
              <span className="text-neutral-700 font-mono">{data.query.model_number}</span>
            </div>
          )}
          {data.query.upc && (
            <div className="flex justify-between">
              <span className="text-neutral-400">UPC</span>
              <span className="text-neutral-700 font-mono">{data.query.upc}</span>
            </div>
          )}
        </div>
      </div>

      {/* Source status */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sources with data */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] text-emerald-600 uppercase tracking-wider mb-2">Data Available</p>
          <div className="flex flex-wrap gap-1.5">
            {meta.sources_with_data.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 bg-white border border-emerald-200 rounded-full text-emerald-700 font-mono">{s}</span>
            ))}
          </div>
        </div>
        {/* Empty sources */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">No Data</p>
          <div className="flex flex-wrap gap-1.5">
            {meta.sources_empty.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 bg-white border border-neutral-200 rounded-full text-neutral-400 font-mono">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Errors */}
      {meta.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-[10px] text-red-500 uppercase tracking-wider mb-2">Errors</p>
          <div className="space-y-1.5">
            {meta.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 font-mono shrink-0">{e.source}</span>
                <span className="text-red-600">{e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data counts */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Data Summary</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {data.components && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Components</span>
              <span className="text-neutral-700 font-mono">{data.components.length}</span>
            </div>
          )}
          {data.patents && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Patents</span>
              <span className="text-neutral-700 font-mono">{data.patents.length}</span>
            </div>
          )}
          {data.teardowns && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Teardowns</span>
              <span className="text-neutral-700 font-mono">{data.teardowns.length}</span>
            </div>
          )}
          {data.fcc && (
            <div className="flex justify-between">
              <span className="text-neutral-400">FCC filings</span>
              <span className="text-neutral-700 font-mono">{data.fcc.length}</span>
            </div>
          )}
          {data.materials.length > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Materials</span>
              <span className="text-neutral-700 font-mono">{data.materials.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
