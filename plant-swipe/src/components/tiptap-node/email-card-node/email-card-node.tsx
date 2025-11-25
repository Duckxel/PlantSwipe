import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback } from "react"
import type { CardStyle } from "./email-card-node-extension"

const CARD_STYLES: { value: CardStyle; label: string; bg: string; border: string }[] = [
  { value: "default", label: "Default", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "highlight", label: "Highlight", bg: "bg-amber-50", border: "border-amber-200" },
  { value: "code", label: "Code", bg: "bg-gray-100", border: "border-gray-300" },
  { value: "warning", label: "Warning", bg: "bg-red-50", border: "border-red-200" },
  { value: "success", label: "Success", bg: "bg-green-50", border: "border-green-200" },
  { value: "info", label: "Info", bg: "bg-blue-50", border: "border-blue-200" },
]

const ICONS = ["📌", "🔑", "💡", "⚠️", "✅", "ℹ️", "🎯", "📧", "🔒", "💳", "📋", "🎁"]

export function EmailCardNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { title, content, style, icon } = node.attrs as {
    title: string
    content: string
    style: CardStyle
    icon: string
  }

  const [isEditing, setIsEditing] = useState(false)

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ title: e.target.value })
    },
    [updateAttributes]
  )

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateAttributes({ content: e.target.value })
    },
    [updateAttributes]
  )

  const styleConfig = CARD_STYLES.find((s) => s.value === style) || CARD_STYLES[0]

  const getStyleClasses = () => {
    switch (style) {
      case "highlight":
        return "bg-gradient-to-br from-amber-50 to-white border-amber-200 dark:from-amber-900/20 dark:to-[#1a1a1d] dark:border-amber-800"
      case "code":
        return "bg-gradient-to-br from-gray-100 to-white border-gray-300 dark:from-gray-800 dark:to-[#1a1a1d] dark:border-gray-700 font-mono"
      case "warning":
        return "bg-gradient-to-br from-red-50 to-white border-red-200 dark:from-red-900/20 dark:to-[#1a1a1d] dark:border-red-800"
      case "success":
        return "bg-gradient-to-br from-green-50 to-white border-green-200 dark:from-green-900/20 dark:to-[#1a1a1d] dark:border-green-800"
      case "info":
        return "bg-gradient-to-br from-blue-50 to-white border-blue-200 dark:from-blue-900/20 dark:to-[#1a1a1d] dark:border-blue-800"
      default:
        return "bg-gradient-to-br from-emerald-50 to-white border-emerald-200 dark:from-emerald-900/20 dark:to-[#1a1a1d] dark:border-emerald-800"
    }
  }

  const getIconBgClass = () => {
    switch (style) {
      case "highlight":
        return "bg-amber-100 dark:bg-amber-900/30"
      case "code":
        return "bg-gray-200 dark:bg-gray-700"
      case "warning":
        return "bg-red-100 dark:bg-red-900/30"
      case "success":
        return "bg-green-100 dark:bg-green-900/30"
      case "info":
        return "bg-blue-100 dark:bg-blue-900/30"
      default:
        return "bg-emerald-100 dark:bg-emerald-900/30"
    }
  }

  return (
    <NodeViewWrapper
      data-type="email-card"
      className={`my-4 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded-2xl" : ""}`}
    >
      <div
        className={`rounded-2xl border p-5 transition-all cursor-pointer ${getStyleClasses()}`}
        onClick={() => setIsEditing(!isEditing)}
      >
        <div className="flex gap-4">
          {/* Icon */}
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl ${getIconBgClass()}`}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Title (optional)"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white"
                />
                <textarea
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Your content here..."
                  rows={3}
                  className={`w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white resize-none ${
                    style === "code" ? "font-mono" : ""
                  }`}
                />

                {/* Style selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                    Card Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CARD_STYLES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => updateAttributes({ style: s.value })}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                          style === s.value
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-[#3e3e42] dark:text-stone-400"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => updateAttributes({ icon: i })}
                        className={`h-9 w-9 rounded-lg border text-lg transition-all ${
                          icon === i
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                            : "border-stone-200 hover:border-stone-300 dark:border-[#3e3e42]"
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {title && (
                  <div className="font-semibold text-stone-800 dark:text-stone-100 mb-1">
                    {title}
                  </div>
                )}
                <div
                  className={`text-stone-600 dark:text-stone-300 text-[15px] leading-relaxed ${
                    style === "code" ? "font-mono text-sm" : ""
                  }`}
                >
                  {content || (
                    <span className="text-stone-400 italic">Click to add content...</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default EmailCardNode
