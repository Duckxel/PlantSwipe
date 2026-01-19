import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart } from 'lucide-react'

interface DoubleTapHeartAnimationProps {
  /** Whether to show the animation */
  show: boolean
  /** Position relative to the container */
  position?: { x: number; y: number }
  /** Callback when animation completes */
  onAnimationComplete?: () => void
}

/**
 * Instagram-style heart animation that appears on double-tap
 * Shows a heart that scales up and fades out
 */
export const DoubleTapHeartAnimation: React.FC<DoubleTapHeartAnimationProps> = ({
  show,
  position,
  onAnimationComplete,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute pointer-events-none z-50 flex items-center justify-center"
          style={{
            left: position?.x ?? '50%',
            top: position?.y ?? '50%',
            transform: position ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.3, 1],
            opacity: [0, 1, 1],
          }}
          exit={{ 
            scale: 1.5,
            opacity: 0,
          }}
          transition={{
            duration: 0.6,
            ease: [0.175, 0.885, 0.32, 1.275], // Custom ease for bouncy feel
            times: [0, 0.5, 1],
          }}
          onAnimationComplete={onAnimationComplete}
        >
          <Heart 
            className="h-24 w-24 text-rose-500 fill-rose-500 drop-shadow-lg"
            strokeWidth={1.5}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook to manage the double-tap heart animation state
 */
export function useDoubleTapHeartAnimation() {
  const [showHeart, setShowHeart] = React.useState(false)
  const [heartPosition, setHeartPosition] = React.useState<{ x: number; y: number } | null>(null)

  const triggerAnimation = React.useCallback((x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      setHeartPosition({ x, y })
    } else {
      setHeartPosition(null) // Will use center position
    }
    setShowHeart(true)
  }, [])

  const hideAnimation = React.useCallback(() => {
    setShowHeart(false)
  }, [])

  return {
    showHeart,
    heartPosition,
    triggerAnimation,
    hideAnimation,
  }
}

export default DoubleTapHeartAnimation
