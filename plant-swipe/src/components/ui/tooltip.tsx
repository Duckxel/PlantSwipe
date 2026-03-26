import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  side?: 'top' | 'bottom'
  delayMs?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className,
  side = 'top',
  delayMs = 0,
}) => {
  const [visible, setVisible] = React.useState(false)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const show = React.useCallback(() => setVisible(true), [])
  const hide = React.useCallback(() => {
    setVisible(false)
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  const handleMouseEnter = React.useCallback(() => {
    if (delayMs > 0) {
      hoverTimer.current = setTimeout(show, delayMs)
    } else {
      show()
    }
  }, [show, delayMs])

  const handleMouseLeave = React.useCallback(() => {
    hide()
  }, [hide])

  // Long press for mobile (500ms)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      e.preventDefault()
      show()
    }, 300)
  }, [show])

  const handleTouchEnd = React.useCallback(() => {
    hide()
  }, [hide])

  // Close on outside touch
  React.useEffect(() => {
    if (!visible) return
    const handleTouch = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        hide()
      }
    }
    document.addEventListener('touchstart', handleTouch)
    return () => document.removeEventListener('touchstart', handleTouch)
  }, [visible, hide])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-lg pointer-events-none',
            'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
            'animate-in fade-in-0 zoom-in-95',
            side === 'top' && 'bottom-full mb-2',
            side === 'bottom' && 'top-full mt-2',
            className,
          )}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 h-0 w-0',
              'border-x-[5px] border-x-transparent',
              side === 'top' && 'top-full border-t-[5px] border-t-stone-900 dark:border-t-stone-100',
              side === 'bottom' && 'bottom-full border-b-[5px] border-b-stone-900 dark:border-b-stone-100',
            )}
          />
        </div>
      )}
    </div>
  )
}
