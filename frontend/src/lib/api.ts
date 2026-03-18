import type {
  RecognitionResult, GenerationStatus, UploadResult, CandidateResponse,
  IntelligenceResult, ComponentResult, PatentResult, TeardownResult, TeardownDetail,
  MaterialResult, FCCResult, BarcodeResult, SpecPackageRequest, Annotation, AnnotationData,
} from './types'

const BASE = '/api/v1'
const BASE_V2 = '/api/v2'

class BackendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackendError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new BackendError(
      'Backend not running. Start it with: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000'
    )
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  uploadImage: async (file: File): Promise<UploadResult> => {
    const form = new FormData()
    form.append('file', file)
    let res: Response
    try {
      res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
    } catch {
      throw new BackendError(
        'Backend not running. Start it with: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000'
      )
    }
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  uploadUrl: (url: string): Promise<UploadResult> =>
    request('/upload/url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  recognize: (fileId: string): Promise<RecognitionResult> =>
    request('/recognize', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    }),

  generate: (fileId: string, prompt?: string, provider = 'tripo'): Promise<{ taskId: string }> =>
    request('/generate', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId, prompt, provider }),
    }),

  generateMultiview: (fileIds: Record<string, string>, prompt?: string, provider = 'tripo'): Promise<{ taskId: string }> =>
    request('/generate', {
      method: 'POST',
      body: JSON.stringify({ file_ids: fileIds, prompt, provider }),
    }),

  pollStatus: (taskId: string): Promise<GenerationStatus> =>
    request(`/status/${taskId}`),

  lookupSpecs: (productName: string, modelNumber?: string, brand?: string): Promise<{
    query: string
    results: Record<string, unknown>[]
    count: number
  }> =>
    request('/specs/lookup', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        model_number: modelNumber,
        brand: brand,
      }),
    }),

  saveToCatalog: (data: {
    recognition: Record<string, unknown>
    dbSpecs?: Record<string, unknown>
    fileIds: string[]
    modelUrl?: string
    generationMethod?: string
  }): Promise<{ slug: string; manifest: Record<string, unknown> }> =>
    request('/catalog/save', {
      method: 'POST',
      body: JSON.stringify({
        recognition: data.recognition,
        db_specs: data.dbSpecs,
        file_ids: data.fileIds,
        model_url: data.modelUrl,
        generation_method: data.generationMethod || 'image_to_model',
      }),
    }),

  listCatalog: (): Promise<{ products: Record<string, unknown>[] }> =>
    request('/catalog'),

  /** Generate 3D from text description only (no photo). */
  generateFromText: (prompt: string, provider = 'tripo'): Promise<{ taskId: string }> =>
    request('/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, provider }),
    }),

  /** Research a product by name (no photo needed). Optionally pass a manual file_id. */
  research: (productName: string, manualFileId?: string): Promise<RecognitionResult> =>
    request('/research', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        manual_file_id: manualFileId,
      }),
    }),

  /** Get top 3 candidate identifications for an image. */
  recognizeCandidates: (fileId: string): Promise<CandidateResponse> =>
    request('/recognize/candidates', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    }),

  /** Get top 3 candidate interpretations for a product name. */
  researchCandidates: (productName: string): Promise<CandidateResponse> =>
    request('/research/candidates', {
      method: 'POST',
      body: JSON.stringify({ product_name: productName }),
    }),

  /** Generate full dossier for a confirmed product identity. */
  confirmRecognition: (productName: string, brand?: string, fileId?: string): Promise<RecognitionResult> =>
    request('/recognize/confirm', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        brand: brand,
        file_id: fileId,
      }),
    }),

  /** Search web for reference images of a confirmed product. */
  researchImages: (productName: string, brand?: string): Promise<{
    images: { file_id: string; angle: string; quality: number; source_url: string }[]
    angle_map: Record<string, string>
    total_found: number
    total_downloaded: number
  }> =>
    request('/research/images', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        brand: brand,
      }),
    }),
}

// ── V2 Intelligence Pipeline API ──

async function requestV2<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_V2}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new BackendError('Backend v2 not running.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api2 = {
  /** Run full intelligence pipeline — all sources in parallel. */
  runIntelligence: (
    productName: string,
    brand?: string,
    modelNumber?: string,
    upc?: string,
    materials?: string[],
  ): Promise<IntelligenceResult> =>
    requestV2('/intelligence', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        brand,
        model_number: modelNumber,
        upc,
        materials,
      }),
    }),

  /** Search electronic components via Octopart. */
  searchComponents: (query: string, limit?: number): Promise<ComponentResult> =>
    requestV2('/components/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  /** Search USPTO patents. */
  searchPatents: (query: string, limit?: number): Promise<PatentResult> =>
    requestV2('/patents/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  /** Search iFixit teardowns. */
  searchTeardowns: (query: string, limit?: number): Promise<TeardownResult> =>
    requestV2('/teardowns/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  /** Get detailed teardown steps. */
  getTeardownDetail: (guideId: number): Promise<TeardownDetail> =>
    requestV2(`/teardowns/${guideId}`),

  /** Lookup material properties. */
  lookupMaterial: (materialName: string): Promise<MaterialResult> =>
    requestV2('/materials/lookup', {
      method: 'POST',
      body: JSON.stringify({ material_name: materialName }),
    }),

  /** Search FCC filings. */
  searchFCC: (query: string, limit?: number): Promise<FCCResult> =>
    requestV2('/fcc/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  /** Lookup barcode/UPC. */
  lookupBarcode: (upc: string): Promise<{ upc: string; product: Record<string, unknown> | null }> =>
    requestV2('/barcode/lookup', {
      method: 'POST',
      body: JSON.stringify({ upc }),
    }),

  /** Generate spec package PDF — returns blob. */
  generateSpecPackage: async (data: SpecPackageRequest): Promise<Blob> => {
    let res: Response
    try {
      res = await fetch(`${BASE_V2}/spec-package/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {
      throw new BackendError('Backend v2 not running.')
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Spec package generation failed: ${res.status}`)
    }
    return res.blob()
  },

  /** Create an annotation on a product. */
  createAnnotation: (slug: string, data: AnnotationData): Promise<Annotation> =>
    requestV2(`/annotations/${slug}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Get all annotations for a product. */
  getAnnotations: (slug: string): Promise<{ annotations: Annotation[]; count: number }> =>
    requestV2(`/annotations/${slug}`),

  /** Update an annotation. */
  updateAnnotation: (slug: string, annotationId: string, data: Partial<AnnotationData>): Promise<Annotation> =>
    requestV2(`/annotations/${slug}/${annotationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Delete an annotation. */
  deleteAnnotation: async (slug: string, annotationId: string): Promise<void> => {
    await requestV2<Record<string, unknown>>(`/annotations/${slug}/${annotationId}`, {
      method: 'DELETE',
    })
  },
}
