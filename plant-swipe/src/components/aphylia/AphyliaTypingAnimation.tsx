/**
 * Aphylia Typing Animation
 * 
 * A 3D animated leaf/plant that "breathes" and pulses while the AI is thinking.
 * Creates a visually engaging loading state similar to typing indicators in messaging apps.
 */

import React, { useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AphyliaTypingAnimationProps {
  className?: string
}

// Leaf SVG path for the 3D effect
const LeafShape: React.FC<{ 
  delay: number
  size: number
  rotation: number
  color: string
}> = ({ delay, size, rotation, color }) => {
  return (
    <motion.div
      className="absolute"
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        perspective: '500px',
      }}
      initial={{ 
        rotateX: 0, 
        rotateY: rotation, 
        rotateZ: 0,
        scale: 0.8,
        opacity: 0.6 
      }}
      animate={{
        rotateX: [0, 15, -10, 5, 0],
        rotateY: [rotation, rotation + 20, rotation - 15, rotation + 10, rotation],
        rotateZ: [0, 5, -5, 3, 0],
        scale: [0.8, 1.1, 0.9, 1.05, 0.8],
        opacity: [0.6, 1, 0.7, 0.9, 0.6],
      }}
      transition={{
        duration: 2.5,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-full h-full drop-shadow-lg"
        style={{
          filter: `drop-shadow(0 4px 6px ${color}40)`,
        }}
      >
        <path
          d="M12 2C6.5 2 2 6.5 2 12c0 1.5.3 3 1 4.3C4.5 14 7 12 12 12c5 0 7.5 2 9 4.3.7-1.3 1-2.8 1-4.3 0-5.5-4.5-10-10-10z"
          fill={color}
          opacity="0.9"
        />
        <path
          d="M12 12c-5 0-7.5 2-9 4.3C4.5 19.5 8 22 12 22s7.5-2.5 9-5.7c-1.5-2.3-4-4.3-9-4.3z"
          fill={color}
          opacity="0.7"
        />
        <path
          d="M12 7v10M9 10l3-3 3 3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
    </motion.div>
  )
}

// Floating particle for ambient effect
const FloatingParticle: React.FC<{ delay: number; x: number; y: number }> = ({ 
  delay, 
  x, 
  y 
}) => {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400/50"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.8, 0],
        scale: [0, 1, 0],
        y: [0, -20, -40],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  )
}

// Main 3D animation component
export const AphyliaTypingAnimation: React.FC<AphyliaTypingAnimationProps> = ({
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      delay: i * 0.3,
      x: 10 + Math.random() * 60,
      y: 20 + Math.random() * 30,
    }))
  }, [])
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center',
        'w-20 h-16',
        className
      )}
      style={{
        perspective: '800px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Central glowing orb */}
      <motion.div
        className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600"
        style={{
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.5), 0 0 60px rgba(16, 185, 129, 0.3)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* 3D rotating leaves */}
      <div className="absolute inset-0 flex items-center justify-center">
        <LeafShape delay={0} size={28} rotation={0} color="#10b981" />
        <LeafShape delay={0.4} size={24} rotation={120} color="#34d399" />
        <LeafShape delay={0.8} size={26} rotation={240} color="#059669" />
      </div>
      
      {/* Floating particles */}
      {particles.map((particle) => (
        <FloatingParticle
          key={particle.id}
          delay={particle.delay}
          x={particle.x}
          y={particle.y}
        />
      ))}
      
      {/* Pulsing ring */}
      <motion.div
        className="absolute w-16 h-16 rounded-full border-2 border-emerald-400/30"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      
      {/* Second pulsing ring (offset) */}
      <motion.div
        className="absolute w-16 h-16 rounded-full border-2 border-emerald-300/20"
        animate={{
          scale: [1, 1.8, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 2,
          delay: 0.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </div>
  )
}

// Simple 3 dots typing indicator as alternative
export const TypingDots: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-emerald-500"
          animate={{
            y: [0, -6, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// Combined typing indicator - just 3 dots, no text
export const AphyliaThinkingIndicator: React.FC<{ 
  className?: string
  compact?: boolean
}> = ({ className, compact = false }) => {
  // Both compact and full show just the dots - clean and simple
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        <TypingDots />
      </div>
    )
  }
  
  return (
    <div className={cn(
      'flex items-center justify-center py-2',
      className
    )}>
      <TypingDots />
    </div>
  )
}

export default AphyliaTypingAnimation
