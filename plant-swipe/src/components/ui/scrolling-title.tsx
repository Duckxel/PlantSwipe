import React, { useRef, useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface ScrollingTitleProps {
  children: React.ReactNode
  className?: string
  /** Tag to render (default: "span") */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div"
  /** Speed in pixels per second (default: 40) */
  speed?: number
}

/**
 * A title component that scrolls horizontally on hover when the text overflows.
 * Uses the scroll-text-left keyframe: scrolls left slowly, pauses, returns
 * quickly, then loops — matching the encyclopedia behavior.
 */
export const ScrollingTitle: React.FC<ScrollingTitleProps> = ({
  children,
  className,
  as: Tag = "span",
  speed = 40,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [scrollDistance, setScrollDistance] = useState(0)

  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const textWidth = textRef.current.scrollWidth
        const overflows = textWidth > containerWidth + 2
        setIsOverflowing(overflows)
        setScrollDistance(overflows ? textWidth - containerWidth + 16 : 0)
      }
    }

    check()

    const observer = new ResizeObserver(check)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [children])

  const onEnter = useCallback(() => {
    if (isOverflowing) setIsHovered(true)
  }, [isOverflowing])

  const onLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  // Duration scales with distance: longer text = longer animation
  const duration = Math.max(2.5, scrollDistance / speed + 1.5)

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden min-w-0", className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Tag
        ref={textRef as React.Ref<never>}
        className={cn(
          "inline-block whitespace-nowrap",
          !isHovered && "overflow-hidden text-ellipsis"
        )}
        style={
          isHovered && scrollDistance > 0
            ? {
                animation: `scroll-text-left ${duration}s ease-in-out infinite`,
                ["--scroll-dist" as string]: `-${scrollDistance}px`,
              }
            : undefined
        }
      >
        {children}
      </Tag>
    </div>
  )
}
