import React, { useRef, useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface ScrollingTitleProps {
  children: React.ReactNode
  className?: string
  /** Tag to render (default: "span") */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div"
  /** Speed in pixels per second (default: 25) */
  speed?: number
}

// Classes that must live on the inner (scrolling) element so they
// travel with the text — e.g. gradient text, font weight, colors.
const INNER_CLASS_PREFIXES = [
  "text-", "font-", "bg-gradient", "bg-clip", "from-", "to-", "via-",
  "tracking-", "leading-", "italic", "underline", "line-through",
  "decoration-", "opacity-",
]

function splitClasses(className?: string): { outer: string; inner: string } {
  if (!className) return { outer: "", inner: "" }
  const tokens = className.split(/\s+/)
  const outer: string[] = []
  const inner: string[] = []
  for (const t of tokens) {
    // Strip any Tailwind prefix like "dark:" or "hover:" for matching
    const bare = t.replace(/^[a-z-]+:/, "")
    if (INNER_CLASS_PREFIXES.some((p) => bare.startsWith(p))) {
      inner.push(t)
    } else {
      outer.push(t)
    }
  }
  return { outer: outer.join(" "), inner: inner.join(" ") }
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
  speed = 25,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [scrollDistance, setScrollDistance] = useState(0)

  const { outer: outerClasses, inner: innerClasses } = splitClasses(className)

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
  const duration = Math.max(3, scrollDistance / speed)

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden min-w-0", outerClasses)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Tag
        ref={textRef as React.Ref<never>}
        className={cn("block whitespace-nowrap max-w-full", innerClasses)}
        style={
          isHovered && scrollDistance > 0
            ? {
                overflow: "visible",
                animation: `scroll-text-left ${duration}s ease-in-out infinite`,
                ["--scroll-dist" as string]: `-${scrollDistance}px`,
              }
            : {
                overflow: "hidden",
                textOverflow: "ellipsis",
              }
        }
      >
        {children}
      </Tag>
    </div>
  )
}
