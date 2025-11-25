import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback } from "react"
import type { ButtonStyle, ButtonSize } from "./email-button-node-extension"

const BUTTON_STYLES: { value: ButtonStyle; label: string; preview: string }[] = [
  { value: "primary", label: "Primary", preview: "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white" },
  { value: "secondary", label: "Secondary", preview: "bg-gradient-to-r from-gray-700 to-gray-600 text-white" },
  { value: "outline", label: "Outline", preview: "border-2 border-emerald-600 text-emerald-600 bg-transparent" },
  { value: "ghost", label: "Ghost", preview: "bg-emerald-100 text-emerald-600" },
]

const BUTTON_SIZES: { value: ButtonSize; label: string; padding: string }[] = [
  { value: "sm", label: "Small", padding: "px-5 py-2 text-sm" },
  { value: "md", label: "Medium", padding: "px-7 py-3 text-base" },
  { value: "lg", label: "Large", padding: "px-10 py-4 text-lg" },
]

export function EmailButtonNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { text, url, style, size, align } = node.attrs as {
    text: string
    url: string
    style: ButtonStyle
    size: ButtonSize
    align: "left" | "center" | "right"
  }

  const [isEditing, setIsEditing] = useState(false)

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ text: e.target.value })
    },
    [updateAttributes]
  )

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ url: e.target.value })
    },
    [updateAttributes]
  )

  const getButtonClasses = () => {
    const baseClasses = "inline-block font-semibold rounded-full transition-all cursor-pointer"
    const sizeClasses = BUTTON_SIZES.find((s) => s.value === size)?.padding || "px-7 py-3 text-base"
    const styleClasses = BUTTON_STYLES.find((s) => s.value === style)?.preview || BUTTON_STYLES[0].preview

    return `${baseClasses} ${sizeClasses} ${styleClasses}`
  }

  return (
    <NodeViewWrapper
      data-type="email-button"
      className={`my-4 ${selected ? "ring-2 ring-emerald-500 ring-offset-2 rounded-lg" : ""}`}
    >
      <div className={`flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
        {isEditing ? (
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Button Text</label>
              <input
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="Click Here"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Link URL</label>
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Style</label>
              <div className="grid grid-cols-4 gap-2">
                {BUTTON_STYLES.map((s) => (
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
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Size</label>
              <div className="grid grid-cols-3 gap-2">
                {BUTTON_SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateAttributes({ size: s.value })}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                      size === s.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-[#3e3e42] dark:text-stone-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Alignment</label>
              <div className="grid grid-cols-3 gap-2">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => updateAttributes({ align: a })}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-all ${
                      align === a
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-[#3e3e42] dark:text-stone-400"
                    }`}
                  >
                    {a}
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
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={getButtonClasses()}
            style={{
              boxShadow: style === "primary" ? "0 10px 30px -5px rgba(16, 185, 129, 0.4)" : undefined,
            }}
          >
            {text || "Click Here"}
          </button>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default EmailButtonNode
