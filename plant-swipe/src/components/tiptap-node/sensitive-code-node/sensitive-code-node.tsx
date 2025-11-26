import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback } from "react"
import { Copy, Check } from "lucide-react"
import type { CodeType } from "./sensitive-code-node-extension"

const CODE_TYPES: { value: CodeType; label: string; icon: string; description: string }[] = [
  { value: "otp", label: "OTP", icon: "🔐", description: "One-time password" },
  { value: "verification", label: "Verification", icon: "✅", description: "Verification code" },
  { value: "password", label: "Password", icon: "🔑", description: "Temporary password" },
  { value: "link", label: "Link", icon: "🔗", description: "Special link or URL" },
  { value: "email", label: "Email", icon: "📧", description: "Email address" },
  { value: "code", label: "Code", icon: "📋", description: "Generic code" },
]

export function SensitiveCodeNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { label, code, type, expiryText, showCopyHint } = node.attrs as {
    label: string
    code: string
    type: CodeType
    expiryText: string
    showCopyHint: boolean
  }

  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const getTypeConfig = () => {
    switch (type) {
      case "otp":
        return {
          bg: "from-amber-100 to-amber-50",
          border: "border-amber-400",
          accent: "text-amber-700",
          iconBg: "bg-amber-200",
        }
      case "verification":
        return {
          bg: "from-emerald-100 to-emerald-50",
          border: "border-emerald-400",
          accent: "text-emerald-700",
          iconBg: "bg-emerald-200",
        }
      case "password":
        return {
          bg: "from-violet-100 to-violet-50",
          border: "border-violet-400",
          accent: "text-violet-700",
          iconBg: "bg-violet-200",
        }
      case "link":
        return {
          bg: "from-blue-100 to-blue-50",
          border: "border-blue-400",
          accent: "text-blue-700",
          iconBg: "bg-blue-200",
        }
      case "email":
        return {
          bg: "from-pink-100 to-pink-50",
          border: "border-pink-400",
          accent: "text-pink-700",
          iconBg: "bg-pink-200",
        }
      case "code":
      default:
        return {
          bg: "from-gray-100 to-gray-50",
          border: "border-gray-400",
          accent: "text-gray-700",
          iconBg: "bg-gray-200",
        }
    }
  }

  const config = getTypeConfig()
  const currentType = CODE_TYPES.find((t) => t.value === type) || CODE_TYPES[0]

  return (
    <NodeViewWrapper
      data-type="sensitive-code"
      className={`my-6 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded-3xl" : ""}`}
    >
      <div
        className={`relative mx-auto max-w-md rounded-3xl border-[3px] border-dashed bg-gradient-to-br p-8 transition-all ${config.bg} ${config.border} dark:from-stone-800 dark:to-stone-900`}
        onClick={() => !isEditing && setIsEditing(true)}
      >
        {isEditing ? (
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
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

            {/* Show copy hint toggle */}
            <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-800">
              <span className="text-sm text-stone-600 dark:text-stone-300">Show "Click to copy" hint</span>
              <button
                type="button"
                onClick={() => updateAttributes({ showCopyHint: !showCopyHint })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  showCopyHint ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-600"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                    showCopyHint ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 cursor-pointer">
            {/* Icon */}
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl ${config.iconBg} dark:bg-opacity-30`}>
              {currentType.icon}
            </div>

            {/* Label */}
            <div className={`text-xs font-bold uppercase tracking-widest ${config.accent} dark:text-opacity-80`}>
              {label || "Your verification code"}
            </div>

            {/* Code display */}
            <div className="relative group">
              <div
                className="rounded-2xl border-2 border-stone-200 bg-white/90 px-8 py-4 font-mono text-3xl font-bold tracking-[0.3em] text-stone-900 shadow-inner dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy()
                }}
              >
                {code || "{{code}}"}
              </div>
              
              {/* Copy button overlay */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy()
                }}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg border border-stone-200 opacity-0 group-hover:opacity-100 transition-opacity dark:bg-stone-700 dark:border-stone-600"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-stone-500" />
                )}
              </button>
            </div>

            {/* Copy hint */}
            {showCopyHint && (
              <div className="text-xs text-stone-400 dark:text-stone-500">
                {copied ? "Copied!" : "Click to copy"}
              </div>
            )}

            {/* Expiry text */}
            {expiryText && (
              <div className="mt-2 text-sm font-medium text-red-500 dark:text-red-400">
                {expiryText}
              </div>
            )}

            {/* Edit hint */}
            <div className="absolute bottom-2 right-2 text-[10px] text-stone-300 dark:text-stone-600">
              Click to edit
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default SensitiveCodeNode
