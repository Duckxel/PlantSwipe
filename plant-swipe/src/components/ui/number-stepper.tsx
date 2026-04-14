import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

type NumberStepperProps = {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  buttonClassName?: string
  valueClassName?: string
  disabled?: boolean
  decrementAriaLabel?: string
  incrementAriaLabel?: string
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  className,
  buttonClassName,
  valueClassName,
  disabled = false,
  decrementAriaLabel = "Decrease value",
  incrementAriaLabel = "Increase value",
}: NumberStepperProps) {
  const safeValue = Number.isFinite(value) ? value : min
  const canDecrement = !disabled && safeValue > min
  const canIncrement = !disabled && safeValue < max

  const updateValue = React.useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next))
      onChange(clamped)
    },
    [max, min, onChange],
  )

  return (
    <div
      className={cn(
        "flex items-center overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => updateValue(safeValue - step)}
        disabled={!canDecrement}
        aria-label={decrementAriaLabel}
        className={cn(
          "flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-700",
          buttonClassName,
        )}
      >
        <Minus className="h-4 w-4" />
      </button>
      <div
        className={cn(
          "min-w-[3rem] px-2 text-center text-lg font-bold tabular-nums text-stone-900 dark:text-white",
          valueClassName,
        )}
      >
        {safeValue}
      </div>
      <button
        type="button"
        onClick={() => updateValue(safeValue + step)}
        disabled={!canIncrement}
        aria-label={incrementAriaLabel}
        className={cn(
          "flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-700",
          buttonClassName,
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
