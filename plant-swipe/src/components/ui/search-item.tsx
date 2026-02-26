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
  /** Currently selected option id (controlled, single-select mode) */
  value: string | null
  /** Called when the user picks an option (single-select mode) */
  onSelect: (option: SearchItemOption) => void
  /** Called when the user clears the selection */
  onClear?: () => void

  // ---- Multi-select mode ----

  /** Enable multi-select mode */
  multiSelect?: boolean
  /** Currently selected option ids (multi-select mode) */
  values?: string[]
  /** Called when the user confirms multi-selection */
  onMultiSelect?: (options: SearchItemOption[]) => void
  /** IDs to show as disabled (e.g. already-added items, current item) */
  disabledIds?: Set<string>
  /** Label for the confirm button in multi-select mode */
  confirmLabel?: string

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

  /**
   * Pre-populated option data for the current `value`.
   * Useful in async mode so the trigger button can display the selected
   * item's label before the dialog has been opened / results fetched.
   */
  initialOption?: SearchItemOption | null
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
      multiSelect = false,
      values = [],
      onMultiSelect,
      disabledIds,
      confirmLabel = "Add Selected",
      options: staticOptions,
      onSearch,
      filterFn = defaultFilter,
      placeholder = "Select an item...",
      title = "Choose Item",
      description: dialogDescription,
      searchPlaceholder = "Search...",
      emptyMessage = "No results found.",
      initialOption,
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
    // Multi-select: local pending selection (not yet confirmed)
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set())

    // In static mode keep a reference to all options for lookup
    const allOptions = staticOptions ?? asyncResults

    // Resolve the currently selected option for display (single-select only)
    // Falls back to initialOption when async results haven't loaded yet
    const selectedOption = React.useMemo(
      () => {
        if (multiSelect || !value) return null
        return allOptions.find((o) => o.id === value)
          ?? (initialOption && initialOption.id === value ? initialOption : null)
      },
      [value, allOptions, initialOption, multiSelect],
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

    // Reset search + pending selection when dialog closes
    React.useEffect(() => {
      if (!open) {
        setSearch("")
        setPendingIds(new Set())
      }
    }, [open])

    // ------ Multi-select helpers ------
    const togglePending = (id: string) => {
      setPendingIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    const confirmMultiSelect = () => {
      if (!onMultiSelect || pendingIds.size === 0) return
      const selected = allOptions.filter(o => pendingIds.has(o.id))
      onMultiSelect(selected)
      setOpen(false)
    }

    // ------ Trigger label ------
    const triggerLabel = multiSelect
      ? (values.length > 0
        ? `${values.length} selected`
        : placeholder)
      : selectedOption
        ? selectedLabel
          ? selectedLabel(selectedOption)
          : selectedOption.label
        : placeholder

    // ------ Default card renderer ------
    const defaultRenderItem = (option: SearchItemOption, isSelected: boolean) => (
      <div className="flex flex-col items-center text-center gap-2 w-full">
        {option.icon && (
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center",
              isSelected
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-gradient-to-br from-stone-100 to-stone-50 dark:from-[#2a2a2d] dark:to-[#232326]",
            )}
          >
            {option.icon}
          </div>
        )}
        <div className="min-w-0 w-full">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className={cn(
                "text-sm font-semibold truncate",
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
            <div className="flex flex-wrap justify-center gap-1 mt-1.5">
              {option.meta.split(", ").map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-[#2a2a2d] text-[10px] text-stone-500 dark:text-stone-400"
                >
                  {tag}
                </span>
              ))}
            </div>
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
          aria-haspopup="dialog"
          aria-expanded={open}
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
            className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] p-0 rounded-2xl flex flex-col"
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
                  aria-label={searchPlaceholder}
                  autoFocus
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-stone-400 hover:text-stone-600"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Multi-select: selection summary bar */}
            {multiSelect && pendingIds.size > 0 && (
              <div className="flex items-center justify-between px-5 py-2 border-b border-stone-100 dark:border-[#2a2a2d] bg-emerald-50 dark:bg-emerald-900/20">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {pendingIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={confirmMultiSelect}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                >
                  {confirmLabel}
                </button>
              </div>
            )}

            {/* Options grid */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {asyncLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="h-8 w-8 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {emptyMessage}
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3" role="list">
                  {filteredOptions.map((option) => {
                    const isItemDisabled = disabledIds?.has(option.id) ?? false
                    const isActive = multiSelect
                      ? pendingIds.has(option.id) || values.includes(option.id)
                      : option.id === value
                    const isAlreadySelected = multiSelect && values.includes(option.id)
                    return (
                      <li key={option.id} className="contents">
                        <button
                          type="button"
                          disabled={isItemDisabled || isAlreadySelected}
                          onClick={() => {
                            if (multiSelect) {
                              togglePending(option.id)
                            } else {
                              onSelect(option)
                              setOpen(false)
                            }
                          }}
                          className={cn(
                            "group relative w-full h-full rounded-xl sm:rounded-2xl border p-4 cursor-pointer transition-all text-left overflow-hidden",
                            (isItemDisabled || isAlreadySelected)
                              ? "opacity-50 cursor-not-allowed border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]"
                              : isActive
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 shadow-md shadow-emerald-500/10"
                                : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/10 sm:hover:-translate-y-0.5",
                          )}
                        >
                          {/* Hover gradient accent */}
                          <div className={cn(
                            "absolute inset-x-0 top-0 h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-opacity",
                            isActive && !isItemDisabled && !isAlreadySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )} />

                          {/* Multi-select checkmark */}
                          {multiSelect && isActive && !isAlreadySelected && (
                            <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center z-10">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}

                          {renderItem
                            ? renderItem(option, isActive)
                            : defaultRenderItem(option, isActive)}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            {multiSelect ? (
              <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100 dark:border-[#2a2a2d]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pendingIds.size === 0}
                  onClick={confirmMultiSelect}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    pendingIds.size > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-400 cursor-not-allowed",
                  )}
                >
                  {confirmLabel}{pendingIds.size > 0 ? ` (${pendingIds.size})` : ""}
                </button>
              </div>
            ) : value && onClear ? (
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
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    )
  },
)

SearchItem.displayName = "SearchItem"

export { SearchItem }
