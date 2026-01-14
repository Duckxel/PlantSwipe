import * as React from "react"
import { Search, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Show loading spinner on the right side */
  loading?: boolean
  /** Custom icon to use instead of Search. Set to `null` to hide the icon entirely */
  icon?: React.ReactNode | null
  /** Size variant: "sm" for compact, "default" for normal, "lg" for large */
  variant?: "sm" | "default" | "lg"
  /** Additional className for the wrapper div */
  wrapperClassName?: string
  /** Callback to clear the input value. If provided, a clear button will appear when input has value */
  onClear?: () => void
}

/**
 * A search input component with a properly positioned search icon.
 * Provides consistent styling across all search fields in the application.
 * 
 * @example
 * // Default with search icon
 * <SearchInput placeholder="Search..." />
 * 
 * @example
 * // Large variant for main search
 * <SearchInput variant="lg" placeholder="Search plants..." />
 * 
 * @example
 * // With loading state
 * <SearchInput loading={isSearching} placeholder="Search..." />
 * 
 * @example
 * // Without icon (plain text search)
 * <SearchInput icon={null} placeholder="Filter by name..." />
 * 
 * @example
 * // Custom styling
 * <SearchInput 
 *   className="border-emerald-300 bg-emerald-50"
 *   wrapperClassName="max-w-md"
 * />
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, loading, icon, variant = "default", wrapperClassName, onClear, ...props }, ref) => {
    const showIcon = icon !== null
    const isSmall = variant === "sm"
    const isLarge = variant === "lg"
    const showClear = !loading && !!onClear && props.value !== undefined && props.value !== ""

    // Calculate padding based on icon visibility and size
    const getLeftPadding = () => {
      if (!showIcon) {
        return isLarge ? "pl-4" : isSmall ? "pl-3" : "pl-4"
      }
      return isLarge ? "pl-11" : isSmall ? "pl-8" : "pl-10"
    }
    
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {/* Search icon - positioned with proper spacing */}
        {showIcon && (
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500",
              isLarge ? "left-4 h-5 w-5" : isSmall ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4"
            )}
            aria-hidden="true"
          >
            {icon || <Search className="h-full w-full" />}
          </span>
        )}
        
        <input
          type="search"
          ref={ref}
          className={cn(
            // Base styles
            "flex w-full border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] shadow-sm transition-colors",
            "placeholder:text-stone-400 dark:placeholder:text-stone-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-400",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Size variants
            isLarge
              ? "h-12 rounded-2xl pr-4 text-base"
              : isSmall
                ? "h-8 rounded-lg pr-3 text-xs"
                : "h-10 rounded-xl pr-4 text-sm md:h-9",
            // Dynamic left padding based on icon
            getLeftPadding(),
            // Loading state or Clear button - add right padding
            (loading || showClear) && (isLarge ? "pr-11" : isSmall ? "pr-8" : "pr-10"),
            className
          )}
          {...props}
        />
        
        {/* Loading spinner */}
        {loading && (
          <Loader2
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 animate-spin text-stone-400",
              isLarge ? "right-4 h-5 w-5" : isSmall ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4"
            )}
            aria-hidden="true"
          />
        )}

        {/* Clear button */}
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 focus-visible:outline-none focus-visible:text-emerald-500 transition-colors",
              isLarge ? "right-4 h-5 w-5" : isSmall ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4"
            )}
            aria-label="Clear search"
          >
            <X className="h-full w-full" />
          </button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = "SearchInput"

export { SearchInput }
