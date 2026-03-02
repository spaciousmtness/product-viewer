import { useState, useRef, useCallback, useEffect } from 'react'
import { ProductViewer, type ProductViewerRef } from './components/viewer/ProductViewer'
import { DropZone } from './components/upload/DropZone'
import { MultiImageUpload } from './components/upload/MultiImageUpload'
import { TextSearch } from './components/upload/TextSearch'
import { ImagePreview } from './components/upload/ImagePreview'
import { PipelineStatus } from './components/pipeline/PipelineStatus'
import { CandidateSelector } from './components/pipeline/CandidateSelector'
import { ViewerControls } from './components/controls/ViewerControls'
import { ExportPanel } from './components/controls/ExportPanel'
import { exportRender, downloadBlob } from './components/viewer/export-renderer'
import { exportSTL, exportGLB, downloadModelUrl } from './components/viewer/model-export'
import { api } from './lib/api'
import type { PipelineStage, RecognitionResult, BackgroundMode, AngleImage, Candidate } from './lib/types'

// Demo GLB for testing the viewer without the backend
const DEMO_MODEL = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'

/** Build a text prompt from recognition data to condition 3D generation. */
function buildGenerationPrompt(recog: RecognitionResult): string {
  // Build a blueprint-oriented prompt: geometry accuracy + correct materials > photorealism.
  // Structure: isolation constraint → identity → materials → dimensions → features

  const lines: string[] = []

  // Lead with the isolation constraint — most important for clean geometry
  lines.push('A single isolated product with NO hands, NO people, NO background objects.')

  // Identity
  let identity = recog.productName
  if (recog.brand) identity += ` by ${recog.brand}`
  lines.push(identity)

  // Materials — the #1 signal for correct surface appearance.
  // Enhanced descriptions help the model choose appropriate PBR properties.
  if (recog.materials && recog.materials.length > 0) {
    const enhanced = recog.materials.map(m => {
      const l = m.toLowerCase()
      if (l.includes('aluminum') || l.includes('aluminium')) return `${m} (brushed metallic, silver-gray)`
      if (l.includes('chrome')) return `${m} (mirror-reflective, bright silver)`
      if (l.includes('steel') || l.includes('stainless')) return `${m} (metallic, cool gray)`
      if (l.includes('leather')) return `${m} (textured grain, matte)`
      if (l.includes('rubber')) return `${m} (matte black, soft-touch)`
      if (l.includes('glass') || l.includes('optical')) return `${m} (transparent/glossy)`
      if (l.includes('plastic')) return `${m} (smooth molded)`
      if (l.includes('wood')) return `${m} (natural grain pattern)`
      if (l.includes('carbon')) return `${m} (woven fiber pattern, matte)`
      if (l.includes('copper') || l.includes('brass')) return `${m} (warm metallic tone)`
      return m
    })
    lines.push(`Materials: ${enhanced.join(', ')}`)
  }

  // Color — explicit, prevents Tripo defaulting to white/gray
  if (recog.colorway) lines.push(`Colorway: ${recog.colorway}`)

  // Dimensions — critical for blueprint accuracy
  if (recog.dimensions) lines.push(`Dimensions: ${recog.dimensions}`)
  lines.push(recog.formFactor)

  // Structural features that define the shape
  if (recog.features.length > 0) {
    lines.push(`Key features: ${recog.features.slice(0, 5).join(', ')}`)
  }

  // Interfaces define port/connector/button geometry
  if (recog.interfaces && recog.interfaces.length > 0) {
    lines.push(`Ports/interfaces: ${recog.interfaces.join(', ')}`)
  }

  return lines.join('. ') + '.'
}

type UploadMode = 'single' | 'multi' | 'search'

/** Check if a DB result is actually relevant to the recognized product. */
function isRelevantMatch(recognizedName: string, dbResult: Record<string, unknown>): boolean {
  const dbName = ((dbResult.name as string) || '').toLowerCase()
  const recogWords = recognizedName.toLowerCase().split(/[\s\-]+/).filter(w => w.length > 2)
  // Need at least 2 significant words matching, or brand match + one word
  const matches = recogWords.filter(w => dbName.includes(w))
  return matches.length >= 2
}

export default function App() {
  const viewerRef = useRef<ProductViewerRef>(null)

  const [stage, setStage] = useState<PipelineStage>('idle')
  const [error, setError] = useState<string>()
  const [progress, setProgress] = useState(0)
  const [imageUrl, setImageUrl] = useState<string>()
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null)
  const [background, setBackground] = useState<BackgroundMode>('gradient')
  const [demoMode, setDemoMode] = useState(false)
  const [modelUrl, setModelUrl] = useState<string>()
  const [dbSpecs, setDbSpecs] = useState<Record<string, unknown> | null>(null)
  const [fileIds, setFileIds] = useState<string[]>([])
  const [savedSlug, setSavedSlug] = useState<string>()

  // Multi-image state
  const [uploadMode, setUploadMode] = useState<UploadMode>('single')
  const [angleImages, setAngleImages] = useState<AngleImage[]>([])

  // Candidate selection state
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)

  // --- Single-image pipeline ---
  const runSinglePipeline = useCallback(
    async (uploadFn: () => Promise<{ fileId: string }>) => {
      setError(undefined)
      setRecognition(null)
      setDbSpecs(null)
      setProgress(0)
      setModelUrl(undefined)
      setSavedSlug(undefined)
      setCandidates(null)

      setStage('uploading')
      try {
        const result = await uploadFn()
        setFileIds([result.fileId])

        // Get candidates instead of single recognition
        setStage('recognizing')
        const resp = await api.recognizeCandidates(result.fileId)
        setCandidates(resp.candidates)
        setStage('selecting')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        setStage('idle')
      }
    },
    []
  )

  // --- Multi-image pipeline ---
  const runMultiPipeline = useCallback(async () => {
    if (angleImages.length === 0) return

    const frontImage = angleImages.find((i) => i.angle === 'front')
    if (!frontImage) {
      setError('Front view is required')
      return
    }

    setError(undefined)
    setRecognition(null)
    setDbSpecs(null)
    setProgress(0)
    setModelUrl(undefined)
    setSavedSlug(undefined)
    setCandidates(null)

    // Upload all images
    setStage('uploading')
    try {
      const uploaded: AngleImage[] = []
      for (const img of angleImages) {
        const result = await api.uploadImage(img.file)
        uploaded.push({ ...img, fileId: result.fileId })
      }
      setAngleImages(uploaded)
      setFileIds(uploaded.map((i) => i.fileId!))

      // Use front image for the preview
      const frontUploaded = uploaded.find((i) => i.angle === 'front')!
      setImageUrl(frontUploaded.previewUrl)

      // Get candidates from front image
      setStage('recognizing')
      const resp = await api.recognizeCandidates(frontUploaded.fileId!)
      setCandidates(resp.candidates)
      setStage('selecting')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setStage('idle')
    }
  }, [angleImages])

  // --- Text search / research pipeline ---
  const runResearchPipeline = useCallback(
    async (productName: string, manualFile?: File) => {
      setError(undefined)
      setRecognition(null)
      setDbSpecs(null)
      setProgress(0)
      setModelUrl(undefined)
      setSavedSlug(undefined)
      setImageUrl(undefined)
      setCandidates(null)

      try {
        // Upload manual if provided
        if (manualFile) {
          setStage('uploading')
          const uploadResult = await api.uploadImage(manualFile)
          setFileIds([uploadResult.fileId])
        }

        // Get candidates for this product name
        setStage('recognizing')
        const resp = await api.researchCandidates(productName)
        setCandidates(resp.candidates)
        setStage('selecting')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        setStage('idle')
      }
    },
    []
  )

  const handleImageSelected = useCallback(
    async (file: File) => {
      const previewUrl = URL.createObjectURL(file)
      setImageUrl(previewUrl)
      setDemoMode(false)
      setUploadMode('single')
      await runSinglePipeline(() => api.uploadImage(file))
    },
    [runSinglePipeline]
  )

  const handleUrlSubmitted = useCallback(
    async (url: string) => {
      setImageUrl(url)
      setDemoMode(false)
      setUploadMode('single')
      await runSinglePipeline(() => api.uploadUrl(url))
    },
    [runSinglePipeline]
  )

  async function pollGeneration(taskId: string): Promise<string> {
    const MAX_POLLS = 60
    const INTERVAL = 4000

    for (let i = 0; i < MAX_POLLS; i++) {
      const status = await api.pollStatus(taskId)

      if (status.status === 'succeeded' && status.modelUrl) {
        setProgress(1)
        return status.modelUrl
      }
      if (status.status === 'failed') {
        throw new Error(status.error || 'Generation failed')
      }

      setProgress(status.progress)
      await new Promise((r) => setTimeout(r, INTERVAL))
    }

    throw new Error('Generation timed out')
  }

  // --- Candidate selected: resume pipeline with confirmed identity ---
  const handleCandidateSelected = useCallback(
    async (productName: string, brand: string | null) => {
      setError(undefined)

      setStage('confirming')
      try {
        const primaryFileId = fileIds[0] || undefined
        const recog = await api.confirmRecognition(productName, brand ?? undefined, primaryFileId)
        setRecognition(recog)
        setCandidates(null)

        // Spec lookup (non-blocking)
        const specQuery = recog.searchHint || recog.productName
        api.lookupSpecs(specQuery, recog.modelNumber ?? undefined, recog.brand ?? undefined)
          .then((res) => {
            const match = res.results.find((r: Record<string, unknown>) => isRelevantMatch(recog.productName, r))
            if (match) setDbSpecs(match as Record<string, unknown>)
          })
          .catch(() => {})

        // Web image research: collect reference images for better 3D generation
        setStage('researching')
        let webAngleMap: Record<string, string> | null = null
        try {
          const research = await api.researchImages(recog.productName, recog.brand ?? undefined)
          if (research.angle_map && Object.keys(research.angle_map).length > 1) {
            webAngleMap = research.angle_map
            // Merge user's original image as front if we have it and web didn't find a better front
            if (fileIds[0] && !webAngleMap['front']) {
              webAngleMap['front'] = fileIds[0]
            }
          }
        } catch {
          // Web research failed — proceed with what we have
          console.log('Web image research failed, using original images')
        }

        // 3D generation — choose best available method
        setStage('generating')
        const prompt = buildGenerationPrompt(recog)

        let taskId: string
        if (webAngleMap && Object.keys(webAngleMap).length > 1) {
          // Best: multiview from web-collected images
          const result = await api.generateMultiview(webAngleMap, prompt)
          taskId = result.taskId
        } else if (uploadMode === 'multi' && angleImages.length > 1) {
          // User provided multiple angles manually
          const fileIdMap: Record<string, string> = {}
          for (const img of angleImages) {
            if (img.fileId) fileIdMap[img.angle] = img.fileId
          }
          const result = await api.generateMultiview(fileIdMap, prompt)
          taskId = result.taskId
        } else if (fileIds[0]) {
          // Single user image
          const result = await api.generate(fileIds[0], prompt)
          taskId = result.taskId
        } else {
          // Text-only (research mode, no images at all)
          const result = await api.generateFromText(prompt)
          taskId = result.taskId
        }

        const url = await pollGeneration(taskId)
        setModelUrl(url)

        setStage('loading')
        await viewerRef.current?.loadModel(url)
        setStage('viewing')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        setStage('idle')
      }
    },
    [fileIds, uploadMode, angleImages]
  )

  // --- Correction: go back to candidate selection from viewing ---
  const handleCorrection = useCallback(() => {
    setStage('selecting')
    setRecognition(null)
    setModelUrl(undefined)
    setDbSpecs(null)
    setSavedSlug(undefined)
  }, [])

  const handleReset = useCallback(() => {
    setStage('idle')
    setError(undefined)
    setProgress(0)
    setImageUrl(undefined)
    setRecognition(null)
    setDemoMode(false)
    setModelUrl(undefined)
    setDbSpecs(null)
    setFileIds([])
    setSavedSlug(undefined)
    setAngleImages([])
    setUploadMode('single')
    setCandidates(null)
  }, [])

  // --- Save to catalog ---
  const handleSaveToCatalog = useCallback(async () => {
    if (!recognition) return
    try {
      const result = await api.saveToCatalog({
        recognition: recognition as unknown as Record<string, unknown>,
        dbSpecs: dbSpecs ?? undefined,
        fileIds,
        modelUrl,
        generationMethod: angleImages.length > 1 ? 'multiview_to_model' : 'image_to_model',
      })
      setSavedSlug(result.slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to catalog')
    }
  }, [recognition, dbSpecs, fileIds, modelUrl, angleImages])

  // --- Demo mode (load sample model without backend) ---
  const handleLoadDemo = useCallback(async () => {
    setDemoMode(true)
    setImageUrl(undefined)
    setRecognition(null)
    setModelUrl(DEMO_MODEL)
    setStage('loading')
    setError(undefined)
    try {
      await viewerRef.current?.loadModel(DEMO_MODEL)
      setStage('viewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo model')
      setStage('idle')
    }
  }, [])

  // --- Export ---
  const handleExport = useCallback(
    async (settings: Parameters<typeof exportRender>[2]) => {
      const viewer = viewerRef.current?.viewer
      if (!viewer) return

      setStage('exporting')
      try {
        const blob = await exportRender(
          viewer.getScene(),
          viewer.getCamera(),
          settings
        )
        const name = recognition?.productName?.replace(/\s+/g, '_') || 'product'
        downloadBlob(blob, `${name}_${settings.width}x${settings.height}.${settings.format}`)
      } finally {
        setStage('viewing')
      }
    },
    [recognition]
  )

  // --- 3D Model export ---
  const handleExportSTL = useCallback(() => {
    const model = viewerRef.current?.viewer?.getModel()
    if (!model) return
    const name = recognition?.productName?.replace(/\s+/g, '_') || 'product'
    exportSTL(model, name)
  }, [recognition])

  const handleExportGLB = useCallback(async () => {
    const model = viewerRef.current?.viewer?.getModel()
    if (!model) return
    const name = recognition?.productName?.replace(/\s+/g, '_') || 'product'
    await exportGLB(model, name)
  }, [recognition])

  const handleDownloadOriginal = useCallback(async () => {
    if (!modelUrl) return
    const name = recognition?.productName?.replace(/\s+/g, '_') || 'product'
    await downloadModelUrl(modelUrl, name)
  }, [modelUrl, recognition])

  // --- Background ---
  const handleBackgroundChange = useCallback(
    (mode: BackgroundMode) => {
      setBackground(mode)
      viewerRef.current?.setBackground(mode)
    },
    []
  )

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (stage !== 'viewing') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'r':
          viewerRef.current?.resetCamera()
          break
        case 'b': {
          const modes: BackgroundMode[] = ['gradient', 'white', 'studio', 'transparent']
          const idx = modes.indexOf(background)
          const next = modes[(idx + 1) % modes.length]
          handleBackgroundChange(next)
          break
        }
        case '1':
          viewerRef.current?.setCameraPreset('front')
          break
        case '2':
          viewerRef.current?.setCameraPreset('quarter')
          break
        case '3':
          viewerRef.current?.setCameraPreset('top')
          break
        case '4':
          viewerRef.current?.setCameraPreset('detail')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stage, background, handleBackgroundChange])

  const showViewer = stage === 'viewing' || stage === 'exporting'

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-11 border-b border-neutral-200 flex items-center justify-between px-4 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col gap-[3px]">
            <div className="w-3.5 h-[2px] bg-neutral-900 rounded-full" />
            <div className="w-2.5 h-[2px] bg-neutral-400 rounded-full" />
            <div className="w-1.5 h-[2px] bg-neutral-300 rounded-full" />
          </div>
          <h1 className="text-[13px] font-semibold text-neutral-900 tracking-tight">Product Viewer</h1>
          <span className="text-[10px] text-neutral-300 font-mono">0.3</span>
        </div>
        {stage !== 'idle' && (
          <button
            onClick={handleReset}
            className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors duration-200 px-2.5 py-1 rounded-md hover:bg-neutral-100"
          >
            New image
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <aside className="w-80 flex-shrink-0 border-r border-neutral-200 p-4 overflow-y-auto space-y-4 bg-white shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
          {/* === IDLE: Upload modes === */}
          {stage === 'idle' && (
            <>
              <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
                {(['single', 'multi', 'search'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setUploadMode(mode)}
                    className={`flex-1 text-xs py-2 transition-all duration-150 ${
                      uploadMode === mode
                        ? 'bg-neutral-900 text-white shadow-inner'
                        : 'bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {{ single: 'Photo', multi: 'Multi-angle', search: 'By name' }[mode]}
                  </button>
                ))}
              </div>

              {uploadMode === 'single' ? (
                <DropZone
                  onImageSelected={handleImageSelected}
                  onUrlSubmitted={handleUrlSubmitted}
                />
              ) : uploadMode === 'multi' ? (
                <>
                  <MultiImageUpload images={angleImages} onImagesChange={setAngleImages} />
                  {angleImages.some((i) => i.angle === 'front') && (
                    <button
                      onClick={runMultiPipeline}
                      className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.98] active:bg-neutral-950 transition-all duration-150"
                    >
                      Generate 3D ({angleImages.length} {angleImages.length === 1 ? 'image' : 'images'})
                    </button>
                  )}
                </>
              ) : (
                <TextSearch onSearch={runResearchPipeline} />
              )}

              <div className="text-center">
                <button onClick={handleLoadDemo} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors underline">
                  Load demo model (no backend needed)
                </button>
              </div>
            </>
          )}

          {/* === SELECTING: Candidate selection === */}
          {stage === 'selecting' && candidates && (
            <>
              {imageUrl && (
                <div className="relative group">
                  <img src={imageUrl} alt="Uploaded product" className="w-full rounded-lg object-cover max-h-40" />
                </div>
              )}
              <CandidateSelector
                candidates={candidates}
                onSelect={handleCandidateSelected}
                isResearch={uploadMode === 'search'}
              />
            </>
          )}

          {/* === PROCESSING: Pipeline progress === */}
          {stage !== 'idle' && stage !== 'selecting' && !showViewer && (
            <PipelineStatus stage={stage} progress={progress} error={error} />
          )}

          {/* === VIEWING: Results === */}
          {showViewer && (
            <>
              {/* 1. Source image (if available) */}
              {imageUrl && (
                <div className="relative group">
                  <img src={imageUrl} alt="Uploaded product" className="w-full rounded-lg object-cover max-h-40" />
                </div>
              )}

              {/* 2. Product dossier */}
              {recognition && (
                <div className="rounded-lg border border-neutral-200 overflow-hidden animate-slideInUp">
                  {/* Product header */}
                  <div className="p-3.5 bg-neutral-50 border-b border-neutral-100 border-l-2 border-l-neutral-900">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
                        {recognition.productName}
                      </h3>
                      <button
                        onClick={handleCorrection}
                        className="flex-shrink-0 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        Not right?
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {recognition.brand && (
                        <span className="text-xs px-2 py-0.5 bg-white border border-neutral-200 rounded-full text-neutral-600">
                          {recognition.brand}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 bg-white border border-neutral-200 rounded-full text-neutral-600">
                        {recognition.category}
                      </span>
                      {recognition.subcategory && recognition.subcategory !== recognition.category && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700">
                          {recognition.subcategory}
                        </span>
                      )}
                      {recognition.yearRange && (
                        <span className="text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700">
                          {recognition.yearRange}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Specs grid */}
                  <div className="p-3 space-y-0 text-xs divide-y divide-neutral-100/80">
                    {recognition.modelNumber && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">Model</span><span className="text-neutral-700 font-mono">{recognition.modelNumber}</span></div>
                    )}
                    {recognition.dimensions && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">Dimensions</span><span className="text-neutral-700">{recognition.dimensions}</span></div>
                    )}
                    {recognition.weight && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">Weight</span><span className="text-neutral-700">{recognition.weight}</span></div>
                    )}
                    {recognition.manufacturingOrigin && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">Origin</span><span className="text-neutral-700">{recognition.manufacturingOrigin}</span></div>
                    )}
                    {recognition.msrpAtRelease && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">MSRP</span><span className="text-neutral-700">{recognition.msrpAtRelease}</span></div>
                    )}
                    {recognition.currentValue && (
                      <div className="flex justify-between py-1.5"><span className="text-neutral-400">Value now</span><span className="text-neutral-700">{recognition.currentValue}</span></div>
                    )}
                  </div>

                  {/* Technical specs (instruments) */}
                  {recognition.technicalSpecs && (
                    <div className="px-3 py-2 border-t border-neutral-100">
                      <p className="text-[10px] text-neutral-400 mb-1.5 uppercase tracking-wider">Technical specs</p>
                      <p className="text-xs text-neutral-600 font-mono leading-relaxed">{recognition.technicalSpecs}</p>
                    </div>
                  )}

                  {/* Interfaces */}
                  {recognition.interfaces && recognition.interfaces.length > 0 && (
                    <div className="px-3 py-2 border-t border-neutral-100">
                      <div className="flex flex-wrap gap-1">
                        {recognition.interfaces.map((iface, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-600">{iface}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Materials */}
                  {recognition.materials && recognition.materials.length > 0 && (
                    <div className="px-3 py-2 border-t border-neutral-100">
                      <p className="text-[10px] text-neutral-400 mb-1.5 uppercase tracking-wider">Materials</p>
                      <div className="flex flex-wrap gap-1">
                        {recognition.materials.map((m, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-600">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {recognition.features.length > 0 && (
                    <div className="px-3 py-2 border-t border-neutral-100">
                      <p className="text-[10px] text-neutral-400 mb-1.5 uppercase tracking-wider">Key features</p>
                      <div className="flex flex-wrap gap-1">
                        {recognition.features.map((f, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-600">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Form factor */}
                  <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50">
                    <p className="text-xs text-neutral-500 leading-relaxed">{recognition.formFactor}</p>
                  </div>

                  {/* Cultural note */}
                  {recognition.culturalNote && (
                    <div className="px-3.5 py-2.5 border-t border-neutral-100 bg-neutral-50/50">
                      <p className="text-xs text-neutral-500 italic leading-relaxed pl-2.5 border-l-2 border-neutral-200">
                        {recognition.culturalNote}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Verified DB specs (formatted) */}
              {dbSpecs && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-emerald-200 bg-emerald-100/50">
                    <p className="text-xs font-medium text-emerald-800">
                      Verified specs — {(dbSpecs as Record<string, unknown>).source as string}
                    </p>
                  </div>
                  <div className="p-3 space-y-1.5 text-xs">
                    <div className="text-emerald-700 font-medium">{(dbSpecs as Record<string, unknown>).name as string}</div>
                    {(() => {
                      const dims = (dbSpecs as Record<string, unknown>).dimensions as Record<string, unknown> | undefined
                      if (!dims) return null
                      return (
                        <div className="space-y-1 mt-1">
                          {dims.height_mm != null && <div className="flex justify-between"><span className="text-emerald-600">Height</span><span className="text-emerald-800 font-mono">{dims.height_mm as number} mm</span></div>}
                          {dims.width_mm != null && <div className="flex justify-between"><span className="text-emerald-600">Width</span><span className="text-emerald-800 font-mono">{dims.width_mm as number} mm</span></div>}
                          {dims.depth_mm != null && <div className="flex justify-between"><span className="text-emerald-600">Depth</span><span className="text-emerald-800 font-mono">{dims.depth_mm as number} mm</span></div>}
                          {dims.weight_g != null && <div className="flex justify-between"><span className="text-emerald-600">Weight</span><span className="text-emerald-800 font-mono">{dims.weight_g as number} g</span></div>}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* 4. Export panel — only when 3D model exists */}
              {modelUrl && (
                <ExportPanel
                  onExport={handleExport}
                  disabled={stage === 'exporting'}
                  modelUrl={modelUrl}
                  productName={recognition?.productName}
                  onExportSTL={handleExportSTL}
                  onExportGLB={handleExportGLB}
                  onDownloadOriginal={handleDownloadOriginal}
                />
              )}

              {/* 5. Save to catalog */}
              <div className="rounded-lg border border-neutral-200 p-3 space-y-2">
                {savedSlug ? (
                  <div className="text-xs text-emerald-600">
                    Saved as <span className="font-mono">{savedSlug}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveToCatalog}
                    disabled={!recognition || stage === 'exporting'}
                    className="w-full py-2 text-sm font-medium rounded-lg border border-neutral-200
                      text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400
                      active:scale-[0.98] active:bg-neutral-100 transition-all duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save to catalog
                  </button>
                )}
                <p className="text-xs text-neutral-400">
                  Save identity, specs{modelUrl ? ', 3D model,' : ''} and provenance as a shareable record.
                </p>
              </div>

              {/* 6. Shortcuts — only when 3D model exists */}
              {modelUrl && (
                <div className="text-xs text-neutral-400 space-y-1 pt-1">
                  <p className="font-medium text-neutral-500">Shortcuts</p>
                  <p><span className="font-mono bg-neutral-100 px-1 rounded">R</span> Reset view</p>
                  <p><span className="font-mono bg-neutral-100 px-1 rounded">B</span> Cycle background</p>
                  <p><span className="font-mono bg-neutral-100 px-1 rounded">1-4</span> Camera presets</p>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Viewer area */}
        <main className="flex-1 relative bg-neutral-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          <ProductViewer
            ref={viewerRef}
            onLoad={() => {}}
            onError={(err) => setError(err)}
            onProgress={(p) => setProgress(p)}
          />

          {/* Overlay: empty state */}
          {stage === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 pointer-events-none overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative text-center space-y-4 max-w-xs animate-fadeIn">
                <div className="mx-auto w-16 h-16 relative">
                  <div className="absolute inset-0 border-2 border-neutral-200 rounded-lg transform rotate-6" />
                  <div className="absolute inset-1 border-2 border-neutral-300 rounded-lg transform -rotate-3" />
                  <div className="absolute inset-2 border-2 border-neutral-400 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-neutral-500 tracking-wide">
                    Drop a product photo
                  </p>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Identify, dimension, and render any product in 3D
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="text-[10px] text-neutral-300 uppercase tracking-widest font-mono">Identify</span>
                  <span className="text-neutral-200">&middot;</span>
                  <span className="text-[10px] text-neutral-300 uppercase tracking-widest font-mono">Dimension</span>
                  <span className="text-neutral-200">&middot;</span>
                  <span className="text-[10px] text-neutral-300 uppercase tracking-widest font-mono">Render</span>
                </div>
              </div>
            </div>
          )}

          {/* Research-only mode: no 3D model, show dossier summary */}
          {showViewer && !modelUrl && recognition && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
              <div className="text-center space-y-3 max-w-md px-6">
                <p className="text-neutral-300 text-5xl">&#x1F50D;</p>
                <h2 className="text-lg font-semibold text-neutral-800">{recognition.productName}</h2>
                <p className="text-sm text-neutral-500">{recognition.formFactor}</p>
                {recognition.culturalNote && (
                  <p className="text-sm text-neutral-400 italic">{recognition.culturalNote}</p>
                )}
                <p className="text-xs text-neutral-400 mt-4">
                  Research complete — dossier in left panel. Upload a photo to generate a 3D model.
                </p>
              </div>
            </div>
          )}

          {/* Overlay: candidate selection */}
          {stage === 'selecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 animate-fadeIn">
              {imageUrl ? (
                <div className="relative flex flex-col items-center gap-4 max-w-lg max-h-[80%]">
                  <img
                    src={imageUrl}
                    alt="Product being identified"
                    className="max-w-full max-h-[70vh] rounded-xl object-contain shadow-lg shadow-neutral-200/50"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-neutral-200">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-neutral-500 font-medium">
                      Select the correct identification in the left panel
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 animate-scaleIn">
                  <div className="mx-auto w-12 h-12 rounded-xl border-2 border-neutral-300 flex items-center justify-center">
                    <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-neutral-500">Candidates ready</p>
                    <p className="text-xs text-neutral-400">Pick the correct product in the left panel</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Overlay: pipeline status */}
          {stage !== 'idle' && stage !== 'selecting' && !showViewer && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100/95 backdrop-blur-[1px] animate-fadeIn">
              <div className="w-96 bg-white rounded-xl p-6 shadow-lg shadow-neutral-200/50 border border-neutral-200/50">
                <PipelineStatus stage={stage} progress={progress} error={error} />
              </div>
            </div>
          )}

          {/* Error overlay (visible even when idle) */}
          {stage === 'idle' && error && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-sm mt-0.5">&#x26A0;</span>
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={() => setError(undefined)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Viewer controls — only with 3D model */}
          {showViewer && modelUrl && (
            <ViewerControls
              background={background}
              onBackgroundChange={handleBackgroundChange}
              onResetCamera={() => viewerRef.current?.resetCamera()}
              onCameraPreset={(p) => viewerRef.current?.setCameraPreset(p)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
