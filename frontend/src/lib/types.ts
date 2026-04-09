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
  | 'intelligence'

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

// ── V2 Intelligence Pipeline Types ──

export interface IntelligenceResult {
  query: { product_name: string; brand: string | null; model_number: string | null; upc: string | null }
  specs: { bestbuy: Record<string, unknown> | null; icecat: Record<string, unknown> | null; wikipedia: Record<string, unknown> | null }
  components: ComponentEntry[] | null
  patents: PatentEntry[] | null
  teardowns: TeardownEntry[] | null
  fcc: FCCEntry[] | null
  barcode: Record<string, unknown> | null
  materials: MaterialEntry[]
  meta: {
    elapsed_ms: number
    sources_with_data: string[]
    sources_empty: string[]
    errors: { source: string; error: string }[]
    total_sources: number
  }
}

export interface ComponentEntry {
  mpn: string
  manufacturer: string
  description: string
  specs: Record<string, string>
  pricing: { currency: string; price: number; quantity: number }[]
  datasheet_url: string | null
  octopart_url: string | null
}

export interface PatentEntry {
  patent_number: string
  title: string
  abstract: string
  inventors: string[]
  assignee: string
  filing_date: string
  patent_type: string
  thumbnail_url: string | null
}

export interface TeardownEntry {
  guide_id: number
  title: string
  device_name: string
  difficulty: string
  steps_count: number
  tools_required: string[]
  url: string
  image_url: string | null
}

export interface TeardownDetail {
  guide_id: number
  title: string
  steps: TeardownStep[]
  tools_required: string[]
  difficulty: string
  url: string
}

export interface TeardownStep {
  step_number: number
  title: string
  text: string
  image_url: string | null
  tools: string[]
}

export interface FCCEntry {
  fcc_id: string
  applicant: string
  product_description: string
  grant_date: string
  detail_url: string
}

export interface MaterialEntry {
  name: string
  material_type: string
  grade: string | null
  density: string | null
  tensile_strength: string | null
  thermal_properties: Record<string, string> | null
  common_applications: string[]
}

export interface ComponentResult {
  query: string
  components: ComponentEntry[]
  count: number
}

export interface PatentResult {
  query: string
  patents: PatentEntry[]
  count: number
}

export interface TeardownResult {
  query: string
  teardowns: TeardownEntry[]
  count: number
}

export interface MaterialResult {
  material: MaterialEntry | null
}

export interface FCCResult {
  query: string
  results: FCCEntry[]
  count: number
}

export interface BarcodeResult {
  upc: string
  product: Record<string, unknown> | null
}

export interface SpecPackageRequest {
  product_name: string
  brand?: string
  recognition?: Record<string, unknown>
  intelligence?: Record<string, unknown>
  sections: {
    dimensions: boolean
    materials: boolean
    components: boolean
    regulatory: boolean
    patents: boolean
    teardowns: boolean
    specs: boolean
  }
}

export interface Annotation {
  id: string
  slug: string
  type: 'note' | 'measurement' | 'flag' | 'spec_ref'
  x: number
  y: number
  text: string
  value: string
  confidence: string
  created_at: string
}

export interface AnnotationData {
  type: 'note' | 'measurement' | 'flag' | 'spec_ref'
  x: number
  y: number
  text: string
  value?: string
  confidence?: string
}
