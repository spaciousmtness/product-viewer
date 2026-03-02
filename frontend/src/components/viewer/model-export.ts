import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { downloadBlob } from './export-renderer'

/**
 * Export the model as binary STL (for 3D printing).
 */
export function exportSTL(model: THREE.Group, filename: string) {
  const exporter = new STLExporter()
  const buffer = exporter.parse(model, { binary: true })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  downloadBlob(blob, `${filename}.stl`)
}

/**
 * Export the model as GLB (binary glTF — preserves materials, textures).
 */
export async function exportGLB(model: THREE.Group, filename: string) {
  const exporter = new GLTFExporter()

  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      model,
      (result) => resolve(result as ArrayBuffer),
      (error) => reject(error),
      { binary: true }
    )
  })

  const blob = new Blob([buffer], { type: 'model/gltf-binary' })
  downloadBlob(blob, `${filename}.glb`)
}

/**
 * Download a model file from a URL (the original Tripo output).
 */
export async function downloadModelUrl(url: string, filename: string) {
  const resp = await fetch(url)
  const blob = await resp.blob()
  downloadBlob(blob, `${filename}.glb`)
}
