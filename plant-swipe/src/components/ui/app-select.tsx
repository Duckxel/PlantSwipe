import * as React from "react"
import { createPortal } from "react-dom"
import * as Popover from "@radix-ui/react-popover"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface AppSelectOption<T extends string = string> {
  value: T
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

export interface AppSelectProps<T extends string = string> {
  value: T | null | undefined
  onChange: (value: T) => void
  options: AppSelectOption<T>[]
  placeholder?: React.ReactNode
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  align?: "start" | "center" | "end"
  ariaLabel?: string
  id?: string
  size?: "sm" | "md"
}

export function AppSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  ariaLabel,
  id,
  size = "md",
}: AppSelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )

  React.useEffect(() => {
    if (!open) return
    const currentIdx = options.findIndex((o) => o.value === value)
    setActiveIndex(currentIdx >= 0 ? currentIdx : options.findIndex((o) => !o.disabled))
  }, [open, options, value])

  React.useEffect(() => {
    if (!open) return
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${activeIndex}"]`)
    btn?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  const moveActive = React.useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((i) => {
        const len = options.length
        if (len === 0) return -1
        let next = i
        for (let step = 0; step < len; step++) {
          next = (next + dir + len) % len
          if (!options[next].disabled) return next
        }
        return i
      })
    },
    [options],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      const idx = options.findIndex((o) => !o.disabled)
      if (idx >= 0) setActiveIndex(idx)
    } else if (e.key === "End") {
      e.preventDefault()
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setActiveIndex(i)
          break
        }
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const opt = options[activeIndex]
      if (opt && !opt.disabled) {
        onChange(opt.value)
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  const heightClass = size === "sm" ? "h-9 text-sm" : "h-10 text-sm"

  return (
    <div className={className}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left text-foreground shadow-sm transition-colors",
              "hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-[#3e3e42] dark:bg-[#2d2d30] dark:text-white dark:hover:border-[#555]",
              heightClass,
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
              <span className={cn("truncate", !selected && "text-muted-foreground")}>
                {selected ? selected.label : placeholder}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align={align}
            sideOffset={6}
            collisionPadding={12}
            onKeyDown={handleKeyDown}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              listRef.current?.focus()
            }}
            className={cn(
              "z-50 w-[var(--radix-popover-trigger-width)] max-w-[min(var(--radix-popover-trigger-width),calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white p-1 shadow-xl outline-none",
              "dark:border-[#3e3e42] dark:bg-[#1f1f1f]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              contentClassName,
            )}
          >
            <div
              ref={listRef}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              className="max-h-[min(60vh,20rem)] overflow-y-auto outline-none scrollbar-hide"
            >
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">—</div>
              )}
              {options.map((opt, i) => {
                const isSelected = value === opt.value
                const isActive = activeIndex === i
                return (
                  <AppSelectOptionRow
                    key={opt.value}
                    opt={opt}
                    index={i}
                    isSelected={isSelected}
                    isActive={isActive}
                    onActivate={() => !opt.disabled && setActiveIndex(i)}
                    onSelect={() => {
                      if (opt.disabled) return
                      onChange(opt.value)
                      setOpen(false)
                    }}
                  />
                )
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

AppSelect.displayName = "AppSelect"

interface AppSelectOptionRowProps<T extends string> {
  opt: AppSelectOption<T>
  index: number
  isSelected: boolean
  isActive: boolean
  onActivate: () => void
  onSelect: () => void
}

function AppSelectOptionRow<T extends string>({
  opt,
  index,
  isSelected,
  isActive,
  onActivate,
  onSelect,
}: AppSelectOptionRowProps<T>) {
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const labelRef = React.useRef<HTMLSpanElement>(null)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = React.useRef(false)
  const [tooltipRect, setTooltipRect] = React.useState<DOMRect | null>(null)

  const showTooltipIfTruncated = React.useCallback(() => {
    const label = labelRef.current
    const btn = buttonRef.current
    if (!label || !btn) return
    if (label.scrollWidth <= label.clientWidth) return
    setTooltipRect(btn.getBoundingClientRect())
  }, [])

  const hideTooltip = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setTooltipRect(null)
  }, [])

  React.useEffect(() => {
    if (!tooltipRect) return
    const onScroll = () => hideTooltip()
    window.addEventListener("scroll", onScroll, true)
    return () => window.removeEventListener("scroll", onScroll, true)
  }, [tooltipRect, hideTooltip])

  React.useEffect(() => () => hideTooltip(), [hideTooltip])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-idx={index}
        disabled={opt.disabled}
        onMouseEnter={() => {
          onActivate()
          showTooltipIfTruncated()
        }}
        onMouseLeave={hideTooltip}
        onTouchStart={() => {
          longPressFired.current = false
          longPressTimer.current = setTimeout(() => {
            longPressFired.current = true
            showTooltipIfTruncated()
          }, 500)
        }}
        onTouchMove={hideTooltip}
        onTouchEnd={(e) => {
          if (longPressFired.current) e.preventDefault()
          hideTooltip()
        }}
        onTouchCancel={hideTooltip}
        onClick={() => {
          if (longPressFired.current) {
            longPressFired.current = false
            return
          }
          onSelect()
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
          isActive && !opt.disabled && "bg-emerald-50 dark:bg-emerald-900/20",
          isSelected && "font-medium text-emerald-700 dark:text-emerald-300",
          !isSelected && !opt.disabled && "text-foreground",
          opt.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
        <span className="flex min-w-0 flex-1 flex-col">
          <span ref={labelRef} className="truncate">{opt.label}</span>
          {opt.description && (
            <span className="truncate text-[11px] text-muted-foreground">
              {opt.description}
            </span>
          )}
        </span>
        {isSelected && (
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
      </button>
      {tooltipRect && typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: tooltipRect.top - 6,
              left: tooltipRect.left + tooltipRect.width / 2,
              transform: "translate(-50%, -100%)",
              maxWidth: "min(90vw, 24rem)",
            }}
            className={cn(
              "pointer-events-none z-[100] rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg",
              "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900",
              "animate-in fade-in-0 zoom-in-95 break-words",
            )}
          >
            {opt.label}
            <div
              className={cn(
                "absolute left-1/2 top-full -translate-x-1/2 h-0 w-0",
                "border-x-[5px] border-x-transparent",
                "border-t-[5px] border-t-stone-900 dark:border-t-stone-100",
              )}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
