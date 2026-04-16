import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'

export type UseFileDropOptions = {
  /** MIME-type prefixes to accept (e.g. ['image/']). */
  accept?: string[]
  /** Max file size in bytes. Files above are silently skipped. */
  maxBytes?: number
  /** Called with the valid files the user dropped. */
  onFiles: (files: File[]) => void
  /** When false, all listeners are noops. Useful on mobile / native where
   *  drag-and-drop is not a user affordance. */
  enabled?: boolean
}

/**
 * Minimal drag-and-drop hook for file inputs. Attach the returned bind props
 * to the drop zone (typically a <label> or <div>). Exposes `isDragging` so
 * callers can style the zone during drag.
 *
 * Intentionally does NOT bind to window — a page-wide drop handler would
 * conflict with rich-text / Tiptap drop zones elsewhere in the app.
 */
export function useFileDrop({ accept, maxBytes, onFiles, enabled = true }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  const accepts = useCallback(
    (file: File) => {
      if (maxBytes && file.size > maxBytes) return false
      if (!accept || accept.length === 0) return true
      return accept.some((prefix) => file.type.startsWith(prefix))
    },
    [accept, maxBytes],
  )

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!enabled) return
    e.preventDefault()
    depth.current += 1
    setIsDragging(true)
  }, [enabled])

  const onDragLeave = useCallback((e: DragEvent) => {
    if (!enabled) return
    e.preventDefault()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsDragging(false)
  }, [enabled])

  const onDragOver = useCallback((e: DragEvent) => {
    if (!enabled) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }, [enabled])

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (!enabled) return
      e.preventDefault()
      depth.current = 0
      setIsDragging(false)
      const items = e.dataTransfer?.files
      if (!items || items.length === 0) return
      const files = Array.from(items).filter(accepts)
      if (files.length > 0) onFiles(files)
    },
    [enabled, accepts, onFiles],
  )

  // Reset drag state if the component unmounts mid-drag.
  useEffect(() => () => { depth.current = 0 }, [])

  return {
    isDragging,
    bind: { onDragEnter, onDragLeave, onDragOver, onDrop },
  }
}
