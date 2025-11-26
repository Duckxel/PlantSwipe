import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { SensitiveCodeNode as SensitiveCodeNodeComponent } from "./sensitive-code-node"

export type CodeType = "otp" | "verification" | "password" | "link" | "email" | "code"

export interface SensitiveCodeNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface SensitiveCodeAttributes {
  label: string
  code: string
  type: CodeType
  expiryText: string
  showCopyHint: boolean
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    sensitiveCode: {
      setSensitiveCode: (options?: Partial<SensitiveCodeAttributes>) => ReturnType
    }
  }
}

export const SensitiveCodeNode = Node.create<SensitiveCodeNodeOptions>({
  name: "sensitiveCode",

  group: "block",

  draggable: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      label: {
        default: "Your verification code",
        parseHTML: (element: HTMLElement) => {
          const labelEl = element.querySelector("[data-label]")
          return labelEl?.textContent || "Your verification code"
        },
      },
      code: {
        default: "{{code}}",
        parseHTML: (element: HTMLElement) => {
          const codeEl = element.querySelector("[data-code]")
          return codeEl?.textContent || "{{code}}"
        },
      },
      type: {
        default: "otp" as CodeType,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-code-type") as CodeType) || "otp"
        },
      },
      expiryText: {
        default: "",
        parseHTML: (element: HTMLElement) => {
          const expiryEl = element.querySelector("[data-expiry]")
          return expiryEl?.textContent || ""
        },
      },
      showCopyHint: {
        default: true,
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute("data-show-copy-hint") !== "false"
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sensitive-code"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { label, code, type, expiryText, showCopyHint } = HTMLAttributes as SensitiveCodeAttributes
    const styles = getCodeStyles(type)

    return [
      "div",
      mergeAttributes(
        {
          "data-type": "sensitive-code",
          "data-code-type": type || "otp",
          "data-show-copy-hint": String(showCopyHint !== false),
          style: `${styles.container} margin: 32px auto; max-width: 420px;`,
        },
        this.options.HTMLAttributes
      ),
      // Inner content wrapper
      [
        "div",
        { style: styles.innerWrapper },
        // Icon
        [
          "div",
          { style: styles.iconWrapper },
          getTypeIcon(type),
        ],
        // Label
        [
          "div",
          { "data-label": "true", style: styles.label },
          label || "Your verification code",
        ],
        // Code display
        [
          "div",
          { "data-code": "true", style: styles.codeBox },
          code || "{{code}}",
        ],
        // Copy hint
        ...(showCopyHint !== false
          ? [
              [
                "div",
                { style: styles.copyHint },
                "Click to copy",
              ],
            ]
          : []),
        // Expiry text
        ...(expiryText
          ? [
              [
                "div",
                { "data-expiry": "true", style: styles.expiry },
                expiryText,
              ],
            ]
          : []),
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SensitiveCodeNodeComponent)
  },

  addCommands() {
    return {
      setSensitiveCode:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: options?.label ?? "Your verification code",
              code: options?.code ?? "{{code}}",
              type: options?.type ?? "otp",
              expiryText: options?.expiryText ?? "",
              showCopyHint: options?.showCopyHint ?? true,
            },
          })
        },
    }
  },
})

function getTypeIcon(type: CodeType): string {
  switch (type) {
    case "otp":
      return "🔐"
    case "verification":
      return "✅"
    case "password":
      return "🔑"
    case "link":
      return "🔗"
    case "email":
      return "📧"
    case "code":
    default:
      return "📋"
  }
}

function getCodeStyles(type: CodeType): Record<string, string> {
  const baseContainer = `
    border-radius: 24px;
    padding: 32px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `.replace(/\s+/g, " ").trim()

  const styleMap: Record<CodeType, { bg: string; border: string; shadow: string; accent: string }> = {
    otp: {
      bg: "linear-gradient(145deg, #fef3c7 0%, #ffffff 50%, #fef9c3 100%)",
      border: "3px dashed #f59e0b",
      shadow: "0 12px 40px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#b45309",
    },
    verification: {
      bg: "linear-gradient(145deg, #d1fae5 0%, #ffffff 50%, #ecfdf5 100%)",
      border: "3px dashed #10b981",
      shadow: "0 12px 40px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#047857",
    },
    password: {
      bg: "linear-gradient(145deg, #ede9fe 0%, #ffffff 50%, #f5f3ff 100%)",
      border: "3px dashed #8b5cf6",
      shadow: "0 12px 40px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#6d28d9",
    },
    link: {
      bg: "linear-gradient(145deg, #dbeafe 0%, #ffffff 50%, #eff6ff 100%)",
      border: "3px dashed #3b82f6",
      shadow: "0 12px 40px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#1d4ed8",
    },
    email: {
      bg: "linear-gradient(145deg, #fce7f3 0%, #ffffff 50%, #fdf2f8 100%)",
      border: "3px dashed #ec4899",
      shadow: "0 12px 40px rgba(236, 72, 153, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#be185d",
    },
    code: {
      bg: "linear-gradient(145deg, #f3f4f6 0%, #ffffff 50%, #f9fafb 100%)",
      border: "3px dashed #6b7280",
      shadow: "0 12px 40px rgba(107, 114, 128, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      accent: "#374151",
    },
  }

  const s = styleMap[type] ?? styleMap.otp

  return {
    container: `${baseContainer} background: ${s.bg}; border: ${s.border}; box-shadow: ${s.shadow};`,
    innerWrapper: "display: flex; flex-direction: column; align-items: center; gap: 12px;",
    iconWrapper: "font-size: 40px; line-height: 1;",
    label: `font-size: 14px; font-weight: 600; color: ${s.accent}; text-transform: uppercase; letter-spacing: 1px;`,
    codeBox: `
      font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #111827;
      background: rgba(255, 255, 255, 0.8);
      padding: 16px 32px;
      border-radius: 16px;
      border: 2px solid rgba(0, 0, 0, 0.08);
      margin: 8px 0;
    `.replace(/\s+/g, " ").trim(),
    copyHint: `font-size: 12px; color: #9ca3af; margin-top: 4px;`,
    expiry: `font-size: 13px; color: #ef4444; font-weight: 500; margin-top: 8px;`,
  }
}

export default SensitiveCodeNode
