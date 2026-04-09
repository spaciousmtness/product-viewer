import { useState } from 'react'
import type { IntelligenceResult } from '../../lib/types'
import { OverviewTab } from './OverviewTab'
import { ComponentsTab } from './ComponentsTab'
import { PatentsTab } from './PatentsTab'
import { TeardownsTab } from './TeardownsTab'
import { MaterialsTab } from './MaterialsTab'
import { RegulatoryTab } from './RegulatoryTab'
import { SpecsTab } from './SpecsTab'

interface Props {
  data: IntelligenceResult | null
  loading: boolean
  error?: string
}

type TabId = 'overview' | 'components' | 'patents' | 'teardowns' | 'materials' | 'regulatory' | 'specs'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'components', label: 'Components' },
  { id: 'patents', label: 'Patents' },
  { id: 'teardowns', label: 'Teardowns' },
  { id: 'materials', label: 'Materials' },
  { id: 'regulatory', label: 'FCC/Regulatory' },
  { id: 'specs', label: 'Specs' },
]

export function IntelligencePanel({ data, loading, error }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Tab badge counts
  const getCount = (tab: TabId): number | null => {
    if (!data) return null
    switch (tab) {
      case 'components': return data.components?.length ?? 0
      case 'patents': return data.patents?.length ?? 0
      case 'teardowns': return data.teardowns?.length ?? 0
      case 'materials': return data.materials.length
      case 'regulatory': return data.fcc?.length ?? 0
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white border-t border-neutral-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-neutral-500 font-medium">Running intelligence pipeline...</span>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-neutral-100 rounded animate-pulse" style={{ width: `${70 - i * 15}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-white border-t border-neutral-200">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-neutral-400">Intelligence pipeline failed</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col bg-white border-t border-neutral-200">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-neutral-400">Intelligence data will appear here after identification</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white border-t border-neutral-200">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-neutral-200 flex overflow-x-auto">
        {TABS.map(tab => {
          const count = getCount(tab.id)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:border-neutral-200'
              }`}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-mono">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'components' && <ComponentsTab components={data.components} />}
        {activeTab === 'patents' && <PatentsTab patents={data.patents} />}
        {activeTab === 'teardowns' && <TeardownsTab teardowns={data.teardowns} />}
        {activeTab === 'materials' && <MaterialsTab materials={data.materials} />}
        {activeTab === 'regulatory' && <RegulatoryTab fcc={data.fcc} />}
        {activeTab === 'specs' && <SpecsTab specs={data.specs} />}
      </div>
    </div>
  )
}
