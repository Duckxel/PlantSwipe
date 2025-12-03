import * as React from "react"
import { Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Show loading spinner on the right side */
  loading?: boolean
  /** Custom icon to use instead of Search */
  icon?: React.ReactNode
  /** Size variant */
  variant?: "default" | "lg"
}

/**
 * A search input component with a properly positioned search icon.
 * Provides consistent styling across all search fields in the application.
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, loading, icon, variant = "default", ...props }, ref) => {
    const isLarge = variant === "lg"
    
    return (
      <div className="relative w-full">
        {/* Search icon - positioned with proper spacing */}
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500",
            isLarge ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
          )}
          aria-hidden="true"
        >
          {icon || <Search className="h-full w-full" />}
        </span>
        
        <input
          type="search"
          ref={ref}
          className={cn(
            // Base styles
            "flex w-full border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] text-base shadow-sm transition-colors",
            "placeholder:text-stone-400 dark:placeholder:text-stone-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-400",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Size variants
            isLarge
              ? "h-12 rounded-2xl pl-11 pr-4 text-base"
              : "h-10 rounded-xl pl-10 pr-4 text-sm md:h-9",
            // Loading state - add right padding for spinner
            loading && "pr-10",
            className
          )}
          {...props}
        />
        
        {/* Loading spinner */}
        {loading && (
          <Loader2
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 animate-spin text-stone-400",
              isLarge ? "right-4 h-5 w-5" : "right-3 h-4 w-4"
            )}
            aria-hidden="true"
          />
        )}
      </div>
    )
  }
)

SearchInput.displayName = "SearchInput"

export { SearchInput }
