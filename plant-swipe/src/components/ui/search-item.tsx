"use client"

import * as React from "react"
import { Search, X, Check, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchItemOption {
  /** Unique identifier for the option */
  id: string
  /** Primary display label */
  label: string
  /** Optional secondary line (subtitle / description) */
  description?: string | null
  /** Optional tertiary metadata line */
  meta?: string | null
  /** Optional icon / avatar rendered to the left */
  icon?: React.ReactNode
}

export interface SearchItemProps {
  /** Currently selected option id (controlled) */
  value: string | null
  /** Called when the user picks an option */
  onSelect: (option: SearchItemOption) => void
  /** Called when the user clears the selection */
  onClear?: () => void

  // ---- Data source (choose ONE) ----

  /**
   * **Static mode** – pass a pre-loaded array of options.
   * The component filters them client-side using `filterFn` or a default
   * label/description search.
   */
  options?: SearchItemOption[]

  /**
   * **Async mode** – provide a function that returns options for a query.
   * Called on every debounced keystroke. When provided, `options` is ignored.
   */
  onSearch?: (query: string) => Promise<SearchItemOption[]>

  /** Custom client-side filter (static mode only). Defaults to label+description includes. */
  filterFn?: (option: SearchItemOption, query: string) => boolean

  // ---- Labels / copy ----

  /** Placeholder shown in the trigger button when nothing is selected */
  placeholder?: string
  /** Dialog title */
  title?: string
  /** Dialog description */
  description?: string
  /** Search input placeholder inside the dialog */
  searchPlaceholder?: string
  /** Message when the list is empty */
  emptyMessage?: string

  // ---- Display ----

  /** Render a custom card for each option. Falls back to a default card. */
  renderItem?: (option: SearchItemOption, isSelected: boolean) => React.ReactNode
  /** Derive the trigger-button label from the full option (when selected). */
  selectedLabel?: (option: SearchItemOption) => string

  /** If true the trigger button shows a spinner */
  loading?: boolean
  /** Additional class on the trigger button */
  className?: string
  /** If the component is nested inside another dialog, bump the z-index */
  priorityZIndex?: number
  /** Disable the trigger */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultFilter = (option: SearchItemOption, query: string) => {
  const q = query.toLowerCase()
  return (
    option.label.toLowerCase().includes(q) ||
    (option.description?.toLowerCase().includes(q) ?? false) ||
    (option.meta?.toLowerCase().includes(q) ?? false)
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchItem = React.forwardRef<HTMLButtonElement, SearchItemProps>(
  (
    {
      value,
      onSelect,
      onClear,
      options: staticOptions,
      onSearch,
      filterFn = defaultFilter,
      placeholder = "Select an item...",
      title = "Choose Item",
      description: dialogDescription,
      searchPlaceholder = "Search...",
      emptyMessage = "No results found.",
      renderItem,
      selectedLabel,
      loading = false,
      className,
      priorityZIndex = 100,
      disabled = false,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [asyncResults, setAsyncResults] = React.useState<SearchItemOption[]>([])
    const [asyncLoading, setAsyncLoading] = React.useState(false)
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    // In static mode keep a reference to all options for lookup
    const allOptions = staticOptions ?? asyncResults

    // Resolve the currently selected option for display
    const selectedOption = React.useMemo(
      () => (value ? allOptions.find((o) => o.id === value) ?? null : null),
      [value, allOptions],
    )

    // ------ Filtered list (static mode) ------
    const filteredOptions = React.useMemo(() => {
      if (onSearch) return asyncResults // async mode – server already filtered
      if (!staticOptions) return []
      if (!search.trim()) return staticOptions
      return staticOptions.filter((o) => filterFn(o, search))
    }, [onSearch, staticOptions, asyncResults, search, filterFn])

    // ------ Async search effect ------
    React.useEffect(() => {
      if (!onSearch || !open) return
      if (debounceRef.current) clearTimeout(debounceRef.current)

      debounceRef.current = setTimeout(async () => {
        setAsyncLoading(true)
        try {
          const results = await onSearch(search)
          setAsyncResults(results)
        } catch {
          setAsyncResults([])
        } finally {
          setAsyncLoading(false)
        }
      }, 300)

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }, [search, onSearch, open])

    // Load initial results when async dialog opens
    React.useEffect(() => {
      if (!onSearch || !open) return
      setAsyncLoading(true)
      onSearch("")
        .then((results) => setAsyncResults(results))
        .catch(() => setAsyncResults([]))
        .finally(() => setAsyncLoading(false))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // Reset search when dialog closes
    React.useEffect(() => {
      if (!open) setSearch("")
    }, [open])

    // ------ Trigger label ------
    const triggerLabel = selectedOption
      ? selectedLabel
        ? selectedLabel(selectedOption)
        : selectedOption.label
      : placeholder

    // ------ Default item renderer ------
    const defaultRenderItem = (option: SearchItemOption, isSelected: boolean) => (
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {option.icon && (
          <div
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              isSelected
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-stone-100 dark:bg-[#2a2a2d]",
            )}
          >
            {option.icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium truncate",
                isSelected
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-stone-900 dark:text-white",
              )}
            >
              {option.label}
            </span>
            {isSelected && (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            )}
          </div>
          {option.description && (
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
              {option.description}
            </p>
          )}
          {option.meta && (
            <p className="text-[10px] text-stone-400 mt-0.5">{option.meta}</p>
          )}
        </div>
      </div>
    )

    return (
      <>
        {/* Trigger button */}
        <button
          ref={ref}
          type="button"
          disabled={disabled || loading}
          onClick={() => {
            setSearch("")
            setOpen(true)
          }}
          className={cn(
            "flex items-center justify-between w-full h-10 rounded-xl border px-3 text-sm transition-colors",
            value
              ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-stone-900 dark:text-white"
              : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] text-stone-500 dark:text-stone-400",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 ml-2 animate-spin text-stone-400" />
          ) : (
            <Search className="h-3.5 w-3.5 flex-shrink-0 ml-2 opacity-50" />
          )}
        </button>

        {/* Search dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="w-[calc(100vw-2rem)] max-w-lg max-h-[80vh] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] p-0 rounded-2xl flex flex-col"
            priorityZIndex={priorityZIndex}
          >
            {/* Header + Search */}
            <div className="px-5 pt-5 pb-3 border-b border-stone-100 dark:border-[#2a2a2d] space-y-3">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-stone-900 dark:text-white">
                  {title}
                </DialogTitle>
                {dialogDescription && (
                  <DialogDescription className="text-xs text-stone-500 dark:text-stone-400">
                    {dialogDescription}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-stone-400 hover:text-stone-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {asyncLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="py-10 text-center">
                  <Search className="h-8 w-8 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {emptyMessage}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.map((option) => {
                    const isActive = option.id === value
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onSelect(option)
                          setOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all",
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700"
                            : "hover:bg-stone-50 dark:hover:bg-[#2a2a2d] border border-transparent",
                        )}
                      >
                        {renderItem
                          ? renderItem(option, isActive)
                          : defaultRenderItem(option, isActive)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Clear selection footer */}
            {value && onClear && (
              <div className="px-5 py-3 border-t border-stone-100 dark:border-[#2a2a2d]">
                <button
                  type="button"
                  onClick={() => {
                    onClear()
                    setOpen(false)
                  }}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 underline"
                >
                  Clear selection
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  },
)

SearchItem.displayName = "SearchItem"

export { SearchItem }
