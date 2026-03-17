import React, { useRef, useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface ScrollingTitleProps {
  children: React.ReactNode
  className?: string
  /** Tag to render (default: "span") */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div"
  /** Speed in pixels per second (default: 25) */
  speed?: number
  /**
   * Activation mode:
   * - "hover"  → scroll on mouse hover (desktop default)
   * - "touch"  → scroll on tap/touch and toggle off on second tap (mobile)
   * - "auto"   → hover on pointer devices, touch on coarse/touch devices
   * Default: "auto"
   */
  mode?: "hover" | "touch" | "auto"
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
  mode = "auto",
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [scrollDistance, setScrollDistance] = useState(0)
  const [resolvedMode, setResolvedMode] = useState<"hover" | "touch">("hover")

  const { outer: outerClasses, inner: innerClasses } = splitClasses(className)

  // Resolve "auto" mode based on device capabilities
  useEffect(() => {
    if (mode !== "auto") {
      setResolvedMode(mode)
      return
    }
    const isCoarse = window.matchMedia("(pointer: coarse)").matches
    setResolvedMode(isCoarse ? "touch" : "hover")
  }, [mode])

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
    if (resolvedMode === "hover" && isOverflowing) setIsActive(true)
  }, [isOverflowing, resolvedMode])

  const onLeave = useCallback(() => {
    if (resolvedMode === "hover") setIsActive(false)
  }, [resolvedMode])

  const onTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (resolvedMode !== "touch" || !isOverflowing) return
      e.stopPropagation()
      setIsActive((prev) => !prev)
    },
    [isOverflowing, resolvedMode],
  )

  // Duration scales with distance: longer text = longer animation
  const duration = Math.max(3, scrollDistance / speed)

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden min-w-0", outerClasses)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onTap}
    >
      <Tag
        ref={textRef as React.Ref<never>}
        className={cn(
          "block whitespace-nowrap",
          isActive ? "w-max" : "max-w-full",
          innerClasses,
        )}
        style={
          isActive && scrollDistance > 0
            ? {
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
