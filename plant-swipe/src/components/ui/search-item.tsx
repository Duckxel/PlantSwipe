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
  /**
   * Called when the user confirms multi-selection.
   * Receives the **full final set** of selected options (existing kept + newly added, minus removed).
   */
  onMultiSelect?: (options: SearchItemOption[]) => void
  /** IDs to show as disabled (e.g. current plant — cannot be selected at all) */
  disabledIds?: Set<string>
  /** Label for the confirm button in multi-select mode */
  confirmLabel?: string
  /**
   * Pre-populated option data for already-selected items (multi-select mode).
   * These are merged into the display list so selected items always appear
   * at the top even if the async search didn't return them.
   */
  selectedOptions?: SearchItemOption[]

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
  /** Control the dialog open state externally */
  open?: boolean
  /** Callback for externally-controlled open state */
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in trigger button (useful when the dialog is opened externally) */
  hideTrigger?: boolean
  /** In single-select mode, require an explicit confirm action instead of selecting immediately */
  requireSingleConfirm?: boolean
  /** Label for the single-select confirm button when confirmation is required */
  singleConfirmLabel?: string
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
      selectedOptions = [],
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
      open: controlledOpen,
      onOpenChange: controlledOnOpenChange,
      hideTrigger = false,
      requireSingleConfirm = false,
      singleConfirmLabel = "Continue",
    },
    ref,
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const open = controlledOpen ?? uncontrolledOpen
    const setOpen = React.useCallback((nextOpen: boolean) => {
      if (controlledOnOpenChange) controlledOnOpenChange(nextOpen)
      else setUncontrolledOpen(nextOpen)
    }, [controlledOnOpenChange])

    const [asyncResults, setAsyncResults] = React.useState<SearchItemOption[]>([])
    const [asyncLoading, setAsyncLoading] = React.useState(false)
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const [pendingSingleOption, setPendingSingleOption] = React.useState<SearchItemOption | null>(null)
    // Multi-select: working set of selected IDs (initialized from `values` on open)
    const [workingIds, setWorkingIds] = React.useState<Set<string>>(new Set())
    // Multi-select: accumulated option data for all items ever toggled on during this session.
    // This prevents losing option data when async search results change after selection.
    const workingOptionsRef = React.useRef<Map<string, SearchItemOption>>(new Map())

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

    // ------ Filtered & merged list ------
    const filteredOptions = React.useMemo(() => {
      let result: SearchItemOption[]
      if (onSearch) result = asyncResults
      else if (!staticOptions) result = []
      else if (!search.trim()) result = staticOptions
      else result = staticOptions.filter((o) => filterFn(o, search))

      // In multi-select mode, merge selected items and sort them to top
      if (multiSelect) {
        const resultIds = new Set(result.map((o) => o.id))

        // Merge: add selectedOptions that aren't already in the result
        const missingSelected = selectedOptions.filter((o) => !resultIds.has(o.id))
        for (const o of missingSelected) { resultIds.add(o.id) }

        // Also merge any newly-selected items from workingOptionsRef that are
        // no longer in the current search results (e.g. user searched, selected,
        // then changed the search query).
        const missingWorking = Array.from(workingOptionsRef.current.values())
          .filter((o) => workingIds.has(o.id) && !resultIds.has(o.id))

        if (missingSelected.length > 0 || missingWorking.length > 0) {
          result = [...result, ...missingSelected, ...missingWorking]
        }

        // Sort: selected items first
        const selected = result.filter((o) => workingIds.has(o.id))
        const rest = result.filter((o) => !workingIds.has(o.id))
        return [...selected, ...rest]
      }
      return result
    }, [onSearch, staticOptions, asyncResults, search, filterFn, multiSelect, selectedOptions, workingIds])

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

    // Initialize working set from `values` when dialog opens; reset when it closes
    React.useEffect(() => {
      if (open) {
        setWorkingIds(new Set(values))
        setPendingSingleOption(null)
        // Seed the working options ref with already-selected options so they can
        // always be resolved on confirm, even if async results change.
        const map = new Map<string, SearchItemOption>()
        for (const o of selectedOptions) map.set(o.id, o)
        workingOptionsRef.current = map
      } else {
        setSearch("")
        setWorkingIds(new Set())
        setPendingSingleOption(null)
        workingOptionsRef.current = new Map()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // ------ Multi-select helpers ------
    const toggleWorking = (id: string, option?: SearchItemOption) => {
      setWorkingIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          // Store the full option data so it survives async result changes
          if (option) workingOptionsRef.current.set(id, option)
        }
        return next
      })
    }

    const confirmMultiSelect = () => {
      if (!onMultiSelect) return
      // Build a complete lookup from all sources: the accumulated working options
      // (which persist across search changes), plus selectedOptions and current results.
      const lookup = new Map<string, SearchItemOption>(workingOptionsRef.current)
      for (const o of selectedOptions) { if (!lookup.has(o.id)) lookup.set(o.id, o) }
      for (const o of allOptions) { if (!lookup.has(o.id)) lookup.set(o.id, o) }
      const finalOptions = Array.from(workingIds)
        .map(id => lookup.get(id))
        .filter((o): o is SearchItemOption => !!o)
      onMultiSelect(finalOptions)
      setOpen(false)
    }

    // Has anything changed from the original values?
    const hasChanges = React.useMemo(() => {
      if (workingIds.size !== values.length) return true
      return values.some(id => !workingIds.has(id))
    }, [workingIds, values])

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
        {!hideTrigger && (
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
        )}

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
            {multiSelect && workingIds.size > 0 && (
              <div className="flex items-center justify-between px-5 py-2 border-b border-stone-100 dark:border-[#2a2a2d] bg-emerald-50 dark:bg-emerald-900/20">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {workingIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={confirmMultiSelect}
                  disabled={!hasChanges}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors",
                    hasChanges
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-stone-300 dark:bg-stone-600 cursor-not-allowed",
                  )}
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
                      ? workingIds.has(option.id)
                      : option.id === value
                    return (
                      <li key={option.id} className="contents">
                        <button
                          type="button"
                          disabled={isItemDisabled}
                          onClick={() => {
                            if (multiSelect) {
                              toggleWorking(option.id, option)
                            } else {
                              if (requireSingleConfirm) {
                                setPendingSingleOption(option)
                              } else {
                                onSelect(option)
                                setOpen(false)
                              }
                            }
                          }}
                          className={cn(
                            "group relative w-full h-full rounded-xl sm:rounded-2xl border cursor-pointer transition-all text-left overflow-hidden",
                            renderItem ? "p-0" : "p-4",
                            isItemDisabled
                              ? "opacity-50 cursor-not-allowed border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]"
                              : isActive
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 shadow-md shadow-emerald-500/10"
                                : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/10 sm:hover:-translate-y-0.5",
                          )}
                        >
                          {/* Hover gradient accent */}
                          <div className={cn(
                            "absolute inset-x-0 top-0 h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-opacity",
                            isActive && !isItemDisabled ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )} />

                          {/* Multi-select checkmark */}
                          {multiSelect && isActive && (
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
                  disabled={!hasChanges}
                  onClick={confirmMultiSelect}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    hasChanges
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-400 cursor-not-allowed",
                  )}
                >
                  {confirmLabel}{workingIds.size > 0 ? ` (${workingIds.size})` : ""}
                </button>
              </div>
            ) : requireSingleConfirm ? (
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
                  disabled={!pendingSingleOption}
                  onClick={() => {
                    if (!pendingSingleOption) return
                    onSelect(pendingSingleOption)
                    setOpen(false)
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    pendingSingleOption
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-400 cursor-not-allowed",
                  )}
                >
                  {singleConfirmLabel}
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
