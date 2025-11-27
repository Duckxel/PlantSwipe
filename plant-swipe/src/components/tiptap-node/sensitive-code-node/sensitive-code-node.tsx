import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState } from "react"
import type { CodeType } from "./sensitive-code-node-extension"

const CODE_TYPES: { value: CodeType; label: string; icon: string; description: string }[] = [
  { value: "otp", label: "OTP", icon: "🔐", description: "One-time password" },
  { value: "verification", label: "Verification", icon: "✅", description: "Verification code" },
  { value: "password", label: "Password", icon: "🔑", description: "Temporary password" },
  { value: "link", label: "Link", icon: "🔗", description: "Special link or URL" },
  { value: "email", label: "Email", icon: "📧", description: "Email address" },
  { value: "code", label: "Code", icon: "📋", description: "Generic code" },
]

// Exact same styles as email HTML output for consistent preview
const EMAIL_STYLES: Record<CodeType, { bg: string; borderColor: string; accentColor: string; iconBg: string }> = {
  otp: {
    bg: "#fef3c7",
    borderColor: "#fbbf24",
    accentColor: "#b45309",
    iconBg: "#fde68a",
  },
  verification: {
    bg: "#d1fae5",
    borderColor: "#34d399",
    accentColor: "#047857",
    iconBg: "#a7f3d0",
  },
  password: {
    bg: "#ede9fe",
    borderColor: "#a78bfa",
    accentColor: "#6d28d9",
    iconBg: "#ddd6fe",
  },
  link: {
    bg: "#dbeafe",
    borderColor: "#60a5fa",
    accentColor: "#1d4ed8",
    iconBg: "#bfdbfe",
  },
  email: {
    bg: "#fce7f3",
    borderColor: "#f472b6",
    accentColor: "#be185d",
    iconBg: "#fbcfe8",
  },
  code: {
    bg: "#f3f4f6",
    borderColor: "#9ca3af",
    accentColor: "#374151",
    iconBg: "#e5e7eb",
  },
}

export function SensitiveCodeNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { label, code, type, expiryText } = node.attrs as {
    label: string
    code: string
    type: CodeType
    expiryText: string
  }

  const [isEditing, setIsEditing] = useState(false)

  const styles = EMAIL_STYLES[type] || EMAIL_STYLES.otp
  const currentType = CODE_TYPES.find((t) => t.value === type) || CODE_TYPES[0]

  return (
    <NodeViewWrapper
      data-type="sensitive-code"
      className={`my-6 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded-2xl" : ""}`}
    >
      {isEditing ? (
        // Editing mode - keep the nice UI for editing
        <div
          className="relative mx-auto max-w-md rounded-2xl border-[3px] border-dashed p-7 transition-all"
          style={{ backgroundColor: styles.bg, borderColor: styles.borderColor }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CODE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => updateAttributes({ type: t.value })}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-xs font-medium transition-all ${
                      type === t.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-400"
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Label input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Label Text
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => updateAttributes({ label: e.target.value })}
                placeholder="Your verification code"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
            </div>

            {/* Code input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Code / Value
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => updateAttributes({ code: e.target.value })}
                placeholder="123456 or {{code}}"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
              <p className="text-xs text-stone-400">
                Use <code className="rounded bg-stone-100 px-1 py-0.5 dark:bg-stone-700">{"{{code}}"}</code> as a variable placeholder
              </p>
            </div>

            {/* Expiry text */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Expiry Notice (optional)
              </label>
              <input
                type="text"
                value={expiryText}
                onChange={(e) => updateAttributes({ expiryText: e.target.value })}
                placeholder="e.g., Expires in 10 minutes"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        // Preview mode - exact same styles as email HTML output
        <div
          className="relative mx-auto max-w-[420px] cursor-pointer"
          onClick={() => setIsEditing(true)}
          style={{
            borderRadius: "16px",
            padding: "28px",
            textAlign: "center",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            backgroundColor: styles.bg,
            border: `3px dashed ${styles.borderColor}`,
          }}
        >
          {/* Icon - using same dimensions as email */}
          <div
            style={{
              display: "inline-block",
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: styles.iconBg,
              fontSize: "28px",
              lineHeight: "56px",
              textAlign: "center",
              verticalAlign: "middle",
              marginBottom: "12px",
            }}
          >
            {currentType.icon}
          </div>

          {/* Label */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: styles.accentColor,
              textTransform: "uppercase",
              letterSpacing: "2px",
              margin: "0 0 12px 0",
            }}
          >
            {label || "Your verification code"}
          </div>

          {/* Code display */}
          <div
            style={{
              fontFamily: "'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#111827",
              backgroundColor: "#ffffff",
              padding: "14px 28px",
              borderRadius: "12px",
              border: "2px solid #e5e7eb",
              display: "inline-block",
              margin: "8px 0",
            }}
          >
            {code || "{{code}}"}
          </div>

          {/* Expiry text */}
          {expiryText && (
            <div
              style={{
                fontSize: "13px",
                color: "#ef4444",
                fontWeight: 500,
                marginTop: "12px",
              }}
            >
              {expiryText}
            </div>
          )}

          {/* Edit hint */}
          <div className="absolute bottom-2 right-2 text-[10px] text-stone-400">
            Click to edit
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default SensitiveCodeNode
