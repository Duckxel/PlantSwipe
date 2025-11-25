import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-150 data-[state=open]:duration-150",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-[60] gap-4 bg-background p-5 sm:p-6 shadow-lg transition ease-out data-[state=closed]:duration-150 data-[state=open]:duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-2xl sm:rounded-t-2xl mx-2 sm:mx-0",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const touchStartYRef = React.useRef<number | null>(null)
  const mouseStartYRef = React.useRef<number | null>(null)
  const isDraggingRef = React.useRef(false)

  const mergeRefs = (node: HTMLDivElement | null) => {
    contentRef.current = node
    if (typeof ref === 'function') {
      ref(node as any)
    } else if (ref && typeof ref === 'object') {
      ;(ref as any).current = node
    }
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const y = e.touches && e.touches.length > 0 ? e.touches[0].clientY : null
    touchStartYRef.current = y
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current
    const el = contentRef.current
    if (!el || startY == null) return
    const currentY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : startY
    const dy = currentY - startY
    // Only close when user pulls down while scrolled at the very top
    if (el.scrollTop <= 0 && dy > 120) {
      touchStartYRef.current = null
      closeRef.current?.click()
    }
  }

  const handleTouchEnd = () => {
    touchStartYRef.current = null
  }

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow dragging from the top area or when scrolled to top
    const el = contentRef.current
    if (!el) return
    
    // Check if target is interactive
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LABEL', 'OPTION'].includes(target.tagName) || 
        target.closest('button') || 
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('.tiptap-editor')) { // Don't drag when interacting with editor
        return;
    }
    
    const rect = el.getBoundingClientRect()
    const isTopArea = e.clientY - rect.top < 60 // Top 60px is draggable area
    const isScrolledToTop = el.scrollTop <= 0
    
    if (isTopArea || isScrolledToTop) {
      mouseStartYRef.current = e.clientY
      isDraggingRef.current = true
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || mouseStartYRef.current === null) return
    
    const el = contentRef.current
    if (!el) return
    
    const dy = e.clientY - mouseStartYRef.current
    
    // Only close when user drags down while scrolled at the very top
    if (el.scrollTop <= 0 && dy > 120) {
      isDraggingRef.current = false
      mouseStartYRef.current = null
      closeRef.current?.click()
    }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
    mouseStartYRef.current = null
  }

  // Global mouse handlers for drag continuation
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || mouseStartYRef.current === null) return
      
      const el = contentRef.current
      if (!el) return
      
      const dy = e.clientY - mouseStartYRef.current
      
      if (el.scrollTop <= 0 && dy > 120) {
        isDraggingRef.current = false
        mouseStartYRef.current = null
        closeRef.current?.click()
      }
    }

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false
      mouseStartYRef.current = null
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  const content = (
    <>
      <SheetPrimitive.Close ref={closeRef} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </>
  )
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={mergeRefs}
        className={cn(sheetVariants({ side }), className)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDraggingRef.current ? 'grabbing' : (side === 'bottom' ? 'grab' : 'default') }}
        {...props}
      >
        {content}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
