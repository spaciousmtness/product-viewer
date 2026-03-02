export type PipelineStage =
  | 'idle'
  | 'uploading'
  | 'recognizing'
  | 'selecting'
  | 'confirming'
  | 'researching'
  | 'generating'
  | 'loading'
  | 'viewing'
  | 'exporting'

export interface Candidate {
  productName: string
  brand: string | null
  confidence: number
  reasoning: string
}

export interface CandidateResponse {
  candidates: Candidate[]
}

export interface RecognitionResult {
  productName: string
  brand: string | null
  category: string
  formFactor: string
  features: string[]
  // Deep identification (product dossier)
  modelNumber?: string
  subcategory?: string          // e.g. "Color Measurement", "Display Testing"
  technicalSpecs?: string       // e.g. "SCE/SCI, 400-700nm, d/8° geometry"
  interfaces?: string[]         // e.g. ["USB", "Bluetooth", "RS-232"]
  accessories?: string          // visible accessories in the image
  yearRange?: string            // e.g. "2006-2015"
  releaseYear?: number
  msrpAtRelease?: string        // e.g. "$89.99"
  currentValue?: string         // approximate current market value
  materials?: string[]          // e.g. ["Cellidor scales", "stainless steel blades"]
  dimensions?: string           // e.g. "91mm x 26.5mm x 33mm"
  weight?: string               // e.g. "185g"
  colorway?: string             // e.g. "Classic Red"
  condition?: string            // e.g. "Well-used, light scratches on scales"
  culturalNote?: string         // e.g. "The SwissChamp was Victorinox's flagship..."
  manufacturingOrigin?: string  // e.g. "Ibach, Switzerland"
  searchHint?: string           // best query for product database lookup
}

export interface GenerationStatus {
  status: 'queued' | 'processing' | 'succeeded' | 'failed'
  progress: number
  modelUrl?: string
  error?: string
}

export interface UploadResult {
  fileId: string
  imageUrl: string
}

export type ViewAngle = 'front' | 'left' | 'back' | 'right'

export interface AngleImage {
  file: File
  previewUrl: string
  angle: ViewAngle
  fileId?: string  // set after upload
}

export type BackgroundMode = 'transparent' | 'white' | 'gradient' | 'studio'

export interface ExportSettings {
  width: number
  height: number
  format: 'png' | 'jpeg'
  quality: number
  transparent: boolean
  background: BackgroundMode
}

export const EXPORT_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '4K': { width: 3840, height: 2160, label: '4K' },
  '8K': { width: 7680, height: 4320, label: '8K' },
  'square-4K': { width: 4096, height: 4096, label: 'Square 4K' },
  'instagram': { width: 1080, height: 1080, label: 'Instagram' },
}
