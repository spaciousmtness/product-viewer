import { useState, useEffect } from 'react'
import type { PipelineStage } from '../../lib/types'

interface Props {
  stage: PipelineStage
  progress: number
  error?: string
}

const STEPS = [
  { key: 'uploading', label: 'Upload' },
  { key: 'recognizing', label: 'Identify' },
  { key: 'confirming', label: 'Confirm' },
  { key: 'researching', label: 'Research' },
  { key: 'generating', label: 'Generate 3D' },
  { key: 'loading', label: 'Load Model' },
] as const

const ORDER: Record<string, number> = {
  idle: -1,
  uploading: 0,
  recognizing: 1,
  selecting: 2,
  confirming: 2,
  researching: 3,
  generating: 4,
  loading: 5,
  viewing: 6,
  exporting: 6,
}

const GENERATION_MESSAGES = [
  'Analyzing geometry from every angle...',
  'Reconstructing surface topology...',
  'Mapping materials and textures...',
  'Refining mesh density...',
  'Calculating light response...',
  'Optimizing polygon count...',
  'Almost there — finalizing details...',
]

export function PipelineStatus({ stage, progress, error }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (stage !== 'generating') {
      setElapsed(0)
      setMsgIdx(0)
      return
    }
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000)
    const msgTimer = setInterval(() => setMsgIdx(prev => (prev + 1) % GENERATION_MESSAGES.length), 5000)
    return () => { clearInterval(timer); clearInterval(msgTimer) }
  }, [stage])

  if (stage === 'idle' || stage === 'viewing' || stage === 'exporting' || stage === 'selecting') return null

  const currentIdx = ORDER[stage] ?? -1

  return (
    <div className="space-y-4 py-6">
      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isComplete = currentIdx > i
          const isCurrent = currentIdx === i
          const isPending = currentIdx < i

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div
                    className={`flex-1 h-0.5 transition-all duration-500 ${
                      isComplete ? 'bg-neutral-900' : 'bg-neutral-200'
                    }`}
                  />
                )}
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                    text-xs font-medium transition-all duration-300
                    ${isComplete ? 'bg-neutral-900 text-white' : ''}
                    ${isCurrent ? 'bg-neutral-900 text-white ring-4 ring-neutral-900/10 shadow-md shadow-neutral-900/20' : ''}
                    ${isPending ? 'bg-neutral-200 text-neutral-400' : ''}
                  `}
                >
                  {isComplete ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-gentleSpin" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 transition-all duration-500 ${
                      isComplete ? 'bg-neutral-900' : 'bg-neutral-200'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs transition-colors duration-300 ${
                  isCurrent ? 'text-neutral-900 font-medium' : isComplete ? 'text-neutral-600' : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar for generation step */}
      {stage === 'generating' && (
        <div className="space-y-3">
          <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-neutral-900 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(Math.min(progress * 100, 100), 2)}%` }}
            />
            <div className="absolute inset-0 animate-shimmer rounded-full" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progress * 100)}%
            </span>
            <span className="text-neutral-300 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-neutral-400 text-center animate-fadeIn" key={msgIdx}>
            {GENERATION_MESSAGES[msgIdx]}
          </p>
        </div>
      )}

      {/* Status message (non-generating stages) */}
      {stage !== 'generating' && (
        <p className="text-sm text-neutral-500 text-center animate-fadeIn" key={stage}>
          {stage === 'uploading' && 'Uploading image...'}
          {stage === 'recognizing' && 'Identifying product...'}
          {stage === 'confirming' && 'Building product dossier...'}
          {stage === 'researching' && 'Collecting reference images from the web...'}
          {stage === 'loading' && 'Loading 3D model...'}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-fadeIn">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
