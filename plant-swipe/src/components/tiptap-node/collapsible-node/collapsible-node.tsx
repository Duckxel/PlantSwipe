import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronRight, Settings2, GripVertical } from "lucide-react"
import type { CollapsibleStyle } from "./collapsible-node-extension"

const COLLAPSIBLE_STYLES: { value: CollapsibleStyle; label: string; icon: string }[] = [
  { value: "default", label: "Default", icon: "📄" },
  { value: "info", label: "Info", icon: "ℹ️" },
  { value: "tip", label: "Tip", icon: "💡" },
  { value: "warning", label: "Warning", icon: "⚠️" },
  { value: "note", label: "Note", icon: "📝" },
]

const STYLE_CLASSES: Record<CollapsibleStyle, { container: string; header: string; headerHover: string; content: string; accent: string }> = {
  default: {
    container: "bg-stone-50 border-stone-200 dark:bg-stone-900/50 dark:border-stone-700",
    header: "bg-stone-100 dark:bg-stone-800",
    headerHover: "hover:bg-stone-200 dark:hover:bg-stone-700",
    content: "border-stone-200 dark:border-stone-700",
    accent: "text-stone-600 dark:text-stone-400",
  },
  info: {
    container: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
    header: "bg-blue-100 dark:bg-blue-900/50",
    headerHover: "hover:bg-blue-200 dark:hover:bg-blue-800/50",
    content: "border-blue-200 dark:border-blue-800",
    accent: "text-blue-700 dark:text-blue-400",
  },
  tip: {
    container: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800",
    header: "bg-emerald-100 dark:bg-emerald-900/50",
    headerHover: "hover:bg-emerald-200 dark:hover:bg-emerald-800/50",
    content: "border-emerald-200 dark:border-emerald-800",
    accent: "text-emerald-700 dark:text-emerald-400",
  },
  warning: {
    container: "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800",
    header: "bg-amber-100 dark:bg-amber-900/50",
    headerHover: "hover:bg-amber-200 dark:hover:bg-amber-800/50",
    content: "border-amber-200 dark:border-amber-800",
    accent: "text-amber-700 dark:text-amber-400",
  },
  note: {
    container: "bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800",
    header: "bg-purple-100 dark:bg-purple-900/50",
    headerHover: "hover:bg-purple-200 dark:hover:bg-purple-800/50",
    content: "border-purple-200 dark:border-purple-800",
    accent: "text-purple-700 dark:text-purple-400",
  },
}

export function CollapsibleNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { title, isOpen, style } = node.attrs as {
    title: string
    isOpen: boolean
    style: CollapsibleStyle
  }

  const [showSettings, setShowSettings] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const titleInputRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const classes = STYLE_CLASSES[style] || STYLE_CLASSES.default
  const currentStyle = COLLAPSIBLE_STYLES.find((s) => s.value === style) || COLLAPSIBLE_STYLES[0]

  const handleToggle = useCallback(() => {
    updateAttributes({ isOpen: !isOpen })
  }, [isOpen, updateAttributes])

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ title: e.target.value })
    },
    [updateAttributes]
  )

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditingTitle(true)
  }, [])

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false)
  }, [])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setIsEditingTitle(false)
    }
  }, [])

  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect()
      // Position dropdown below the button, aligned to the right edge
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 256), // 256px is the dropdown width (w-64)
      })
    }
    setShowSettings(!showSettings)
  }, [showSettings])

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Close settings when clicking outside
  useEffect(() => {
    if (!showSettings) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        settingsRef.current && 
        !settingsRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setShowSettings(false)
      }
    }

    // Also close on scroll
    const handleScroll = () => {
      setShowSettings(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [showSettings])

  return (
    <NodeViewWrapper
      data-type="collapsible"
      className={`collapsible-node my-4 rounded-xl border transition-all ${classes.container} ${
        selected ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#0f0f11]" : ""
      }`}
    >
      {/* Header - marked as non-editable to prevent cursor issues */}
      <div
        className={`collapsible-header flex items-center gap-2 rounded-t-xl px-3 py-3 transition-colors ${classes.header} ${
          !isEditingTitle ? classes.headerHover : ""
        }`}
        contentEditable={false}
      >
        {/* Drag handle */}
        <div
          className="collapsible-drag-handle cursor-grab opacity-40 hover:opacity-70 transition-opacity"
          contentEditable={false}
          data-drag-handle
        >
          <GripVertical className="h-4 w-4 text-stone-400" />
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={handleToggle}
          className={`flex-shrink-0 rounded-lg p-1.5 transition-all ${classes.accent} hover:bg-white/50 dark:hover:bg-black/20`}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse section" : "Expand section"}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Style icon */}
        <span className="text-base" role="img" aria-label={currentStyle.label}>
          {currentStyle.icon}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className={`w-full bg-white dark:bg-stone-800 rounded-lg px-3 py-1.5 text-sm font-semibold border border-stone-200 dark:border-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${classes.accent}`}
              placeholder="Section title..."
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onClick={handleTitleClick}
              className={`block truncate font-semibold text-sm cursor-text ${classes.accent}`}
              title="Click to edit title"
            >
              {title || "Click to add title..."}
            </span>
          )}
        </div>

        {/* Settings button */}
        <div className="relative" ref={settingsRef}>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={handleSettingsClick}
            className={`flex-shrink-0 rounded-lg p-1.5 transition-all opacity-60 hover:opacity-100 ${classes.accent} hover:bg-white/50 dark:hover:bg-black/20`}
            aria-label="Section settings"
            aria-haspopup="true"
            aria-expanded={showSettings}
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Settings dropdown - rendered via portal for proper z-index handling */}
          {showSettings && createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[9999] w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-xl dark:border-stone-700 dark:bg-stone-800 animate-in fade-in-0 zoom-in-95 duration-150"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-2">
                    Section Style
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COLLAPSIBLE_STYLES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          updateAttributes({ style: s.value })
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs font-medium transition-all ${
                          style === s.value
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                            : "border-transparent hover:border-stone-200 dark:hover:border-stone-600"
                        }`}
                        title={s.label}
                      >
                        <span className="text-lg">{s.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700">
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    Default state
                  </span>
                  <button
                    type="button"
                    onClick={() => updateAttributes({ isOpen: !isOpen })}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                      isOpen
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                        : "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-400"
                    }`}
                  >
                    {isOpen ? "Expanded" : "Collapsed"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Content area - editable section where users can add any content */}
      <div
        className={`collapsible-content-wrapper transition-all duration-200 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0 max-h-0 overflow-hidden"
        }`}
        style={{
          maxHeight: isOpen ? "none" : "0",
        }}
        data-state={isOpen ? "open" : "closed"}
      >
        <div className={`collapsible-content border-t p-4 ${classes.content} text-stone-900 dark:text-stone-200`}>
          {/* NodeViewContent renders the editable content - this is where paragraphs, lists, etc. go */}
          <NodeViewContent className="collapsible-inner-content text-inherit" />
        </div>
      </div>

      {/* Collapsed preview - non-editable hint */}
      {!isOpen && (
        <div
          className={`px-4 py-2 text-xs text-stone-500 dark:text-stone-400 italic border-t ${classes.content} cursor-pointer hover:text-stone-600 dark:hover:text-stone-300 transition-colors`}
          onClick={handleToggle}
          contentEditable={false}
        >
          Click to expand and see content...
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default CollapsibleNode
