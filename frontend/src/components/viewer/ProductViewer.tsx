import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { createProductViewer, type ViewerInstance } from './viewer-engine'
import type { BackgroundMode } from '../../lib/types'

export interface ProductViewerRef {
  loadModel: (url: string) => Promise<void>
  setBackground: (mode: BackgroundMode) => void
  resetCamera: () => void
  setCameraPreset: (preset: 'front' | 'quarter' | 'top' | 'detail') => void
  viewer: ViewerInstance | null
}

interface Props {
  onLoad?: () => void
  onError?: (error: string) => void
  onProgress?: (progress: number) => void
}

export const ProductViewer = forwardRef<ProductViewerRef, Props>(
  ({ onLoad, onError, onProgress }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<ViewerInstance | null>(null)

    useEffect(() => {
      if (!containerRef.current) return

      const viewer = createProductViewer(containerRef.current, {
        onLoad,
        onError,
        onProgress,
      })
      viewerRef.current = viewer

      const handleResize = () => viewer.resize()
      const ro = new ResizeObserver(handleResize)
      ro.observe(containerRef.current)

      return () => {
        ro.disconnect()
        viewer.dispose()
        viewerRef.current = null
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const loadModel = useCallback(async (url: string) => {
      if (viewerRef.current) await viewerRef.current.loadModel(url)
    }, [])

    const setBackground = useCallback((mode: BackgroundMode) => {
      viewerRef.current?.setBackground(mode)
    }, [])

    const resetCamera = useCallback(() => {
      viewerRef.current?.resetCamera()
    }, [])

    const setCameraPreset = useCallback(
      (preset: 'front' | 'quarter' | 'top' | 'detail') => {
        viewerRef.current?.setCameraPreset(preset)
      },
      []
    )

    useImperativeHandle(ref, () => ({
      loadModel,
      setBackground,
      resetCamera,
      setCameraPreset,
      viewer: viewerRef.current,
    }))

    return (
      <div
        ref={containerRef}
        className="w-full h-full relative"
        style={{ minHeight: 300 }}
      />
    )
  }
)

ProductViewer.displayName = 'ProductViewer'
