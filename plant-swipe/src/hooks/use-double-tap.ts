import { useRef, useCallback } from 'react'

interface UseDoubleTapOptions {
  onDoubleTap: () => void
  onSingleTap?: () => void
  delay?: number
}

/**
 * Hook to detect double-tap gestures (like Instagram double-tap to like)
 * @param options - Configuration options
 * @param options.onDoubleTap - Callback fired on double-tap
 * @param options.onSingleTap - Optional callback fired on single tap (after delay if no second tap)
 * @param options.delay - Max time between taps in ms (default: 300ms)
 */
export function useDoubleTap({
  onDoubleTap,
  onSingleTap,
  delay = 300,
}: UseDoubleTapOptions) {
  const lastTapRef = useRef<number>(0)
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapPositionRef = useRef<{ x: number; y: number } | null>(null)

  const handleTap = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now()
      const timeSinceLastTap = now - lastTapRef.current

      // Get tap position
      let x: number, y: number
      if ('touches' in event && event.touches.length > 0) {
        x = event.touches[0].clientX
        y = event.touches[0].clientY
      } else if ('clientX' in event) {
        x = event.clientX
        y = event.clientY
      } else {
        return
      }

      // Check if this is a double-tap (second tap within delay and close to first tap position)
      const isDoubleTap =
        timeSinceLastTap < delay &&
        tapPositionRef.current &&
        Math.abs(x - tapPositionRef.current.x) < 50 &&
        Math.abs(y - tapPositionRef.current.y) < 50

      if (isDoubleTap) {
        // Clear the single tap timeout since this is a double tap
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current)
          singleTapTimeoutRef.current = null
        }
        
        lastTapRef.current = 0
        tapPositionRef.current = null
        onDoubleTap()
      } else {
        // Record this tap
        lastTapRef.current = now
        tapPositionRef.current = { x, y }

        // Set timeout for single tap callback
        if (onSingleTap) {
          if (singleTapTimeoutRef.current) {
            clearTimeout(singleTapTimeoutRef.current)
          }
          singleTapTimeoutRef.current = setTimeout(() => {
            onSingleTap()
            singleTapTimeoutRef.current = null
          }, delay)
        }
      }
    },
    [onDoubleTap, onSingleTap, delay]
  )

  // Return both the position ref (for showing animation at tap location) and handler
  return {
    handleTap,
    tapPositionRef,
  }
}

export default useDoubleTap
