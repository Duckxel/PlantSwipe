import * as React from "react"
import { Loader2, Check, AlertCircle, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FieldStatus } from "@/hooks/useFieldValidation"

export interface ValidatedInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Input type – supports password toggle when set to "password" */
  type?: React.HTMLInputTypeAttribute
  /** Validation status – drives the icon and ring color */
  status?: FieldStatus
  /** Error message to display below the input */
  error?: string | null
  /** Suggestion text (e.g., "Did you mean gmail.com?") */
  suggestion?: string | null
  /** Callback when the user accepts a suggestion */
  onAcceptSuggestion?: () => void
  /** Additional className for the outer wrapper div */
  wrapperClassName?: string
}

/**
 * A form input with built-in validation feedback.
 *
 * Shows a loading spinner while validating, a green checkmark when valid,
 * and a red error icon + message when invalid. Supports password visibility
 * toggle and email typo suggestions.
 *
 * Designed to be paired with the `useFieldValidation` hook but can also
 * be driven manually via the `status` / `error` props.
 *
 * @example
 * ```tsx
 * const { status, error } = useFieldValidation(email, validateEmailFn)
 * <ValidatedInput
 *   type="email"
 *   value={email}
 *   onChange={e => setEmail(e.target.value)}
 *   status={status}
 *   error={error}
 *   placeholder="you@example.com"
 * />
 * ```
 */
const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      className,
      type = "text",
      status = "idle",
      error,
      suggestion,
      onAcceptSuggestion,
      wrapperClassName,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const errorId = React.useId()
    const suggestionId = React.useId()
    const isPassword = type === "password"
    const effectiveType = isPassword && showPassword ? "text" : type

    // Ring color based on status
    const ringClass =
      status === "valid"
        ? "ring-2 ring-emerald-400/60 border-emerald-400 dark:ring-emerald-500/40 dark:border-emerald-500"
        : status === "error"
          ? "ring-2 ring-red-400/60 border-red-400 dark:ring-red-500/40 dark:border-red-500"
          : ""

    // How much right padding we need (status icon + optional password toggle)
    const hasStatusIcon = status === "validating" || status === "valid" || status === "error"
    const rightPadding = isPassword && hasStatusIcon
      ? "pr-[4.5rem]" // room for both icons
      : isPassword
        ? "pr-10" // just password toggle
        : hasStatusIcon
          ? "pr-10" // just status icon
          : ""

    // Construct aria-describedby based on what's visible
    const describedBy = [
      status === "error" && error ? errorId : null,
      suggestion ? suggestionId : null,
      props["aria-describedby"]
    ].filter(Boolean).join(" ") || undefined

    return (
      <div className={cn("w-full", wrapperClassName)}>
        {/* Input row – icons are positioned relative to this container only */}
        <div className="relative">
          <input
            ref={ref}
            type={effectiveType}
            aria-describedby={describedBy}
            className={cn(
              "flex h-10 w-full rounded-xl border border-input bg-white dark:bg-[#2d2d30] px-4 py-2 text-base shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:rounded-md md:px-3 md:py-1 md:text-sm",
              ringClass,
              rightPadding,
              className,
            )}
            {...props}
          />

          {/* Right-side icons – centred within the input row */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Validation status icon */}
            {status === "validating" && (
              <Loader2
                className="h-4 w-4 animate-spin text-stone-400 dark:text-stone-500"
                aria-hidden="true"
              />
            )}
            {status === "valid" && (
              <Check
                className="h-4 w-4 text-emerald-500 dark:text-emerald-400 animate-in fade-in zoom-in-50 duration-200"
                aria-hidden="true"
              />
            )}
            {status === "error" && (
              <AlertCircle
                className="h-4 w-4 text-red-500 dark:text-red-400 animate-in fade-in zoom-in-50 duration-200"
                aria-hidden="true"
              />
            )}

            {/* Password visibility toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error message – outside the relative container so it doesn't shift icons */}
        {status === "error" && error && (
          <p
            id={errorId}
            className="mt-1 text-xs text-red-500 dark:text-red-400 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {error}
          </p>
        )}

        {/* Suggestion */}
        {suggestion && onAcceptSuggestion && (
          <button
            type="button"
            id={suggestionId}
            onClick={onAcceptSuggestion}
            className="mt-1 text-xs text-left text-amber-600 dark:text-amber-400 hover:underline animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {suggestion}
          </button>
        )}
      </div>
    )
  },
)

ValidatedInput.displayName = "ValidatedInput"

export { ValidatedInput }
