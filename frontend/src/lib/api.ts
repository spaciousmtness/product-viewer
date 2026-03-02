import type { RecognitionResult, GenerationStatus, UploadResult, CandidateResponse } from './types'

const BASE = '/api/v1'

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
