import * as THREE from 'three'
import type { ExportSettings } from '../../lib/types'

export const EXPORT_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '4K': { width: 3840, height: 2160, label: '4K' },
  '8K': { width: 7680, height: 4320, label: '8K' },
  'square-4K': { width: 4096, height: 4096, label: 'Square 4K' },
  'instagram': { width: 1080, height: 1080, label: 'Instagram' },
}

function getMaxRenderSize(): number {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  const maxSize = gl ? gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) : 4096
  canvas.remove()
  return maxSize as number
}

export async function exportRender(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: ExportSettings
): Promise<Blob> {
  const { width, height, format, quality, transparent } = settings
  const maxSize = getMaxRenderSize()

  if (width > maxSize || height > maxSize) {
    return exportTiled(scene, camera, settings, maxSize)
  }

  return exportDirect(scene, camera, settings)
}

async function exportDirect(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: ExportSettings
): Promise<Blob> {
  const { width, height, format, quality, transparent } = settings

  // Save original camera state
  const origAspect = camera.aspect

  // Create dedicated export renderer
  const exportRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparent,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  exportRenderer.setSize(width, height)
  exportRenderer.setPixelRatio(1)
  exportRenderer.outputColorSpace = THREE.SRGBColorSpace
  exportRenderer.toneMapping = THREE.ACESFilmicToneMapping
  exportRenderer.toneMappingExposure = 1.0
  exportRenderer.shadowMap.enabled = true
  exportRenderer.shadowMap.type = THREE.PCFShadowMap

  // Adjust camera for export dimensions
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  // Render single frame
  exportRenderer.render(scene, camera)

  // Extract as blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    exportRenderer.domElement.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      format === 'jpeg' ? quality : undefined
    )
  })

  // Restore camera
  camera.aspect = origAspect
  camera.updateProjectionMatrix()

  // Cleanup
  exportRenderer.dispose()

  return blob
}

async function exportTiled(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: ExportSettings,
  maxTileSize: number
): Promise<Blob> {
  const { width, height, format, quality } = settings

  const tilesX = Math.ceil(width / maxTileSize)
  const tilesY = Math.ceil(height / maxTileSize)
  const tileW = Math.ceil(width / tilesX)
  const tileH = Math.ceil(height / tilesY)

  // Stitching canvas
  const stitchCanvas = document.createElement('canvas')
  stitchCanvas.width = width
  stitchCanvas.height = height
  const ctx = stitchCanvas.getContext('2d')!

  const exportRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  exportRenderer.setSize(tileW, tileH)
  exportRenderer.setPixelRatio(1)
  exportRenderer.outputColorSpace = THREE.SRGBColorSpace
  exportRenderer.toneMapping = THREE.ACESFilmicToneMapping
  exportRenderer.toneMappingExposure = 1.0
  exportRenderer.shadowMap.enabled = true
  exportRenderer.shadowMap.type = THREE.PCFShadowMap

  // Save original camera state
  const origAspect = camera.aspect

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      camera.setViewOffset(width, height, tx * tileW, ty * tileH, tileW, tileH)
      camera.updateProjectionMatrix()

      exportRenderer.render(scene, camera)
      ctx.drawImage(exportRenderer.domElement, tx * tileW, ty * tileH)
    }
  }

  // Restore camera
  camera.clearViewOffset()
  camera.aspect = origAspect
  camera.updateProjectionMatrix()

  exportRenderer.dispose()

  // Export stitched result
  return new Promise<Blob>((resolve, reject) => {
    stitchCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Tile export failed'))),
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      format === 'jpeg' ? quality : undefined
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
