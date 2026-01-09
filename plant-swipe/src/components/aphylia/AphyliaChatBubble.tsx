/**
 * Aphylia Chat Bubble
 * 
 * A floating action button that opens the AI chat panel.
 * Positioned in the bottom-right corner of the screen.
 * On mobile, positioned above the navigation bar.
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AphyliaChatBubbleProps {
  isOpen: boolean
  onClick: () => void
  hasUnreadMessage?: boolean
  className?: string
}

export const AphyliaChatBubble: React.FC<AphyliaChatBubbleProps> = ({
  isOpen,
  onClick,
  hasUnreadMessage = false,
  className
}) => {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        // Position: above mobile nav on mobile, normal position on desktop
        'fixed z-50',
        // Mobile: above the nav bar (which is ~60px + safe area)
        'bottom-[calc(70px+env(safe-area-inset-bottom))] right-4',
        // Desktop: normal bottom-right position
        'md:bottom-6 md:right-6',
        // Size: slightly smaller on mobile
        'w-12 h-12 md:w-14 md:h-14 rounded-full',
        'bg-gradient-to-br from-emerald-500 to-emerald-600',
        'hover:from-emerald-400 hover:to-emerald-500',
        // Subtle shadow - reduced from shadow-lg to shadow-md with lower opacity
        'shadow-md shadow-emerald-500/20',
        'flex items-center justify-center',
        'transition-all duration-300 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        'group',
        className
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      aria-label={isOpen ? 'Close Aphylia chat' : 'Open Aphylia chat'}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <X className="w-6 h-6 text-white" />
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Sparkles icon as main icon */}
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Unread indicator */}
      {hasUnreadMessage && !isOpen && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        />
      )}
      
      {/* Hover tooltip */}
      <div className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900/90 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        {isOpen ? 'Close chat' : 'Ask Aphylia'}
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-gray-900/90" />
      </div>
      
      {/* Subtle pulse animation when closed - reduced intensity */}
      {!isOpen && (
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-400/30"
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{
            scale: [1, 1.2],
            opacity: [0.3, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeOut'
          }}
        />
      )}
    </motion.button>
  )
}

export default AphyliaChatBubble
