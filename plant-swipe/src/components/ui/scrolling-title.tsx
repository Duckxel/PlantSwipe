import React, { useRef, useState, useEffect } from "react"
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
 * Works like a marquee effect — the text slides left to reveal truncated content,
 * then resets when the mouse leaves.
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

  const duration = scrollDistance / speed

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden min-w-0", className)}
      onMouseEnter={() => isOverflowing && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Tag
        ref={textRef as React.Ref<never>}
        className="inline-block whitespace-nowrap"
        style={{
          transform: isHovered ? `translateX(-${scrollDistance}px)` : "translateX(0)",
          transition: isHovered
            ? `transform ${duration}s linear`
            : "transform 0.3s ease-out",
        }}
      >
        {children}
      </Tag>
    </div>
  )
}
