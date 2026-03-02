import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import type { BackgroundMode } from '../../lib/types'

export interface ViewerOptions {
  hdriPath?: string
  background?: BackgroundMode
  onProgress?: (progress: number) => void
  onLoad?: () => void
  onError?: (error: string) => void
}

export interface ViewerInstance {
  loadModel: (url: string) => Promise<void>
  setBackground: (mode: BackgroundMode) => void
  resetCamera: () => void
  setCameraPreset: (preset: 'front' | 'quarter' | 'top' | 'detail') => void
  getScene: () => THREE.Scene
  getCamera: () => THREE.PerspectiveCamera
  getRenderer: () => THREE.WebGLRenderer
  getModel: () => THREE.Group | null
  resize: () => void
  dispose: () => void
}

const DEFAULT_HDRI = '/hdri/studio_small_09_1k.hdr'

export function createProductViewer(
  container: HTMLElement,
  options: ViewerOptions = {}
): ViewerInstance {
  const width = container.offsetWidth
  const height = container.offsetHeight

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  container.appendChild(renderer.domElement)

  // --- Scene ---
  const scene = new THREE.Scene()

  // --- Camera ---
  // 35mm FOV = telephoto look, less distortion, product-photography feel
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100)
  camera.position.set(1.5, 1.0, 2.5)

  // --- Controls ---
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 0.6
  controls.minDistance = 0.3
  controls.maxDistance = 10
  controls.target.set(0, 0.4, 0)
  controls.enablePan = true
  controls.maxPolarAngle = Math.PI * 0.9

  // --- Lighting ---
  // Key light (warm, above-right)
  const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2)
  keyLight.position.set(3, 4, 2)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  keyLight.shadow.camera.near = 0.1
  keyLight.shadow.camera.far = 20
  keyLight.shadow.camera.left = -3
  keyLight.shadow.camera.right = 3
  keyLight.shadow.camera.top = 3
  keyLight.shadow.camera.bottom = -3
  keyLight.shadow.bias = -0.001
  scene.add(keyLight)

  // Fill light (cool, opposite side)
  const fillLight = new THREE.DirectionalLight(0xe6eeff, 0.4)
  fillLight.position.set(-2, 2, -1)
  scene.add(fillLight)

  // Rim light (defines silhouette edge)
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.6)
  rimLight.position.set(-1, 3, -3)
  scene.add(rimLight)

  // Ambient (very low — HDRI handles most)
  const ambient = new THREE.AmbientLight(0xffffff, 0.1)
  scene.add(ambient)

  // --- Ground plane (shadow catcher) ---
  const groundGeo = new THREE.PlaneGeometry(20, 20)
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  scene.add(ground)

  // --- Environment map (HDRI) ---
  let envMap: THREE.Texture | null = null
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()

  const hdrLoader = new HDRLoader()
  const hdriPath = options.hdriPath || DEFAULT_HDRI

  hdrLoader.load(
    hdriPath,
    (hdrTexture) => {
      envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture
      scene.environment = envMap
      hdrTexture.dispose()
      pmremGenerator.dispose()
    },
    undefined,
    () => {
      // HDRI failed to load — use a fallback neutral environment
      console.warn('HDRI not found, using fallback lighting')
      const fallbackEnv = pmremGenerator.fromScene(
        new THREE.Scene()
      ).texture
      scene.environment = fallbackEnv
      pmremGenerator.dispose()
    }
  )

  // --- Model loading ---
  const gltfLoader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  gltfLoader.setDRACOLoader(dracoLoader)

  let currentModel: THREE.Group | null = null

  async function loadModel(url: string): Promise<void> {
    // Remove previous model
    if (currentModel) {
      scene.remove(currentModel)
      currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
      currentModel = null
    }

    return new Promise<void>((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene

          // Auto-center and normalize scale
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 1.5 / maxDim
          model.scale.setScalar(scale)
          model.position.sub(center.multiplyScalar(scale))

          // Place bottom on y=0
          const newBox = new THREE.Box3().setFromObject(model)
          model.position.y -= newBox.min.y

          // Enable shadows + ensure PBR materials respond to environment
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.envMapIntensity = 1.0
              }
            }
          })

          scene.add(model)
          currentModel = model

          // Reset camera to frame the model
          resetCamera()
          options.onLoad?.()
          resolve()
        },
        (event) => {
          if (event.total > 0) {
            options.onProgress?.(event.loaded / event.total)
          }
        },
        (error) => {
          const msg = error instanceof Error ? error.message : 'Failed to load model'
          options.onError?.(msg)
          reject(new Error(msg))
        }
      )
    })
  }

  // --- Background ---
  function setBackground(mode: BackgroundMode) {
    switch (mode) {
      case 'transparent':
        scene.background = null
        break
      case 'white':
        scene.background = new THREE.Color(0xf5f5f5)
        break
      case 'gradient': {
        const canvas = document.createElement('canvas')
        canvas.width = 2
        canvas.height = 256
        const ctx = canvas.getContext('2d')!
        const grad = ctx.createLinearGradient(0, 0, 0, 256)
        grad.addColorStop(0, '#e8e4e0')
        grad.addColorStop(1, '#d0ccc8')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 2, 256)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        scene.background = tex
        break
      }
      case 'studio':
        if (envMap) scene.background = envMap
        break
    }
  }

  // Set initial background
  setBackground(options.background || 'gradient')

  // --- Camera presets ---
  function resetCamera() {
    camera.position.set(1.5, 1.0, 2.5)
    controls.target.set(0, 0.4, 0)
    controls.update()
  }

  function setCameraPreset(preset: 'front' | 'quarter' | 'top' | 'detail') {
    switch (preset) {
      case 'front':
        camera.position.set(0, 0.5, 3)
        controls.target.set(0, 0.4, 0)
        break
      case 'quarter':
        camera.position.set(1.5, 1.0, 2.5)
        controls.target.set(0, 0.4, 0)
        break
      case 'top':
        camera.position.set(0, 3.5, 0.3)
        controls.target.set(0, 0.4, 0)
        break
      case 'detail':
        camera.position.set(0.5, 0.5, 1.2)
        controls.target.set(0, 0.3, 0)
        break
    }
    controls.update()
  }

  // --- Render loop ---
  let animationId: number
  function animate() {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // --- Resize handler ---
  function resize() {
    const w = container.offsetWidth
    const h = container.offsetHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  // --- Cleanup ---
  function dispose() {
    cancelAnimationFrame(animationId)
    controls.dispose()
    renderer.dispose()
    if (currentModel) {
      currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement)
    }
  }

  return {
    loadModel,
    setBackground,
    resetCamera,
    setCameraPreset,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getModel: () => currentModel,
    resize,
    dispose,
  }
}
