import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState } from "react"
import type { DividerStyle } from "./styled-divider-node-extension"

const DIVIDER_STYLES: { value: DividerStyle; label: string; icon: string }[] = [
  { value: "solid", label: "Solid", icon: "—" },
  { value: "gradient", label: "Gradient", icon: "◆" },
  { value: "dashed", label: "Dashed", icon: "- -" },
  { value: "dots", label: "Dots", icon: "•••" },
  { value: "fancy", label: "Fancy", icon: "✦" },
  { value: "wave", label: "Wave", icon: "〰" },
  { value: "stars", label: "Stars", icon: "★" },
]

const COLORS = [
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "gray", label: "Gray", class: "bg-gray-500" },
]

export function StyledDividerNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { style, color } = node.attrs as {
    style: DividerStyle
    color: string
  }

  const [isEditing, setIsEditing] = useState(false)

  const colorMap: Record<string, { primary: string; secondary: string }> = {
    emerald: { primary: "#059669", secondary: "#34d399" },
    blue: { primary: "#2563eb", secondary: "#60a5fa" },
    purple: { primary: "#7c3aed", secondary: "#a78bfa" },
    pink: { primary: "#db2777", secondary: "#f472b6" },
    amber: { primary: "#d97706", secondary: "#fbbf24" },
    gray: { primary: "#4b5563", secondary: "#9ca3af" },
  }

  const colors = colorMap[color] || colorMap.emerald

  const renderDivider = () => {
    switch (style) {
      case "gradient":
        return (
          <div
            className="h-[3px] rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent)`,
            }}
          />
        )
      case "dashed":
        return (
          <div
            className="h-0 opacity-50"
            style={{ borderTop: `2px dashed ${colors.primary}` }}
          />
        )
      case "dots":
        return (
          <div className="flex justify-center gap-3">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors.secondary }}
            />
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors.primary }}
            />
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors.secondary }}
            />
          </div>
        )
      case "fancy":
        return (
          <div className="flex items-center gap-4">
            <div
              className="h-[1px] flex-1"
              style={{
                background: `linear-gradient(90deg, transparent, ${colors.primary})`,
              }}
            />
            <span style={{ color: colors.primary }} className="text-xl">
              ✦
            </span>
            <div
              className="h-[1px] flex-1"
              style={{
                background: `linear-gradient(90deg, ${colors.primary}, transparent)`,
              }}
            />
          </div>
        )
      case "wave":
        return (
          <svg
            viewBox="0 0 400 20"
            className="h-5 w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,10 C50,20 100,0 150,10 C200,20 250,0 300,10 C350,20 400,0 400,10"
              fill="none"
              stroke={colors.primary}
              strokeWidth="2"
            />
          </svg>
        )
      case "stars":
        return (
          <div
            className="flex justify-center gap-2 text-xs"
            style={{ color: colors.primary }}
          >
            ✦ ✦ ✦ ✦ ✦
          </div>
        )
      case "solid":
      default:
        return (
          <div
            className="h-[2px] rounded-full opacity-30"
            style={{ background: colors.primary }}
          />
        )
    }
  }

  return (
    <NodeViewWrapper
      data-type="styled-divider"
      className={`my-6 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded" : ""}`}
    >
      <div
        className="group relative cursor-pointer py-4"
        onClick={() => setIsEditing(!isEditing)}
      >
        {renderDivider()}

        {/* Edit indicator on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-stone-500 shadow-sm dark:bg-[#1a1a1d]/90 dark:text-stone-400">
            Click to edit
          </span>
        </div>
      </div>

      {isEditing && (
        <div className="mx-auto mt-2 max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              Divider Style
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DIVIDER_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateAttributes({ style: s.value })}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all ${
                    style === s.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-[#3e3e42] dark:text-stone-400"
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              Color
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => updateAttributes({ color: c.value })}
                  className={`h-8 w-8 rounded-full transition-all ${c.class} ${
                    color === c.value
                      ? "ring-2 ring-offset-2 ring-stone-400"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.label}
                />
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
      )}
    </NodeViewWrapper>
  )
}

export default StyledDividerNode
