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
        // Copy instruction (static text for emails - no JS interaction)
        ...(showCopyHint !== false
          ? [
              [
                "div",
                { style: styles.copyHint },
                "Copy and paste this code",
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
  // Styles matching the editor component (sensitive-code-node.tsx)
  const styleMap: Record<CodeType, { bgGradient: string; borderColor: string; accentColor: string; iconBg: string }> = {
    otp: {
      bgGradient: "linear-gradient(to bottom right, #fef3c7, #fefce8)",
      borderColor: "#fbbf24",
      accentColor: "#b45309",
      iconBg: "#fde68a",
    },
    verification: {
      bgGradient: "linear-gradient(to bottom right, #d1fae5, #ecfdf5)",
      borderColor: "#34d399",
      accentColor: "#047857",
      iconBg: "#a7f3d0",
    },
    password: {
      bgGradient: "linear-gradient(to bottom right, #ede9fe, #f5f3ff)",
      borderColor: "#a78bfa",
      accentColor: "#6d28d9",
      iconBg: "#ddd6fe",
    },
    link: {
      bgGradient: "linear-gradient(to bottom right, #dbeafe, #eff6ff)",
      borderColor: "#60a5fa",
      accentColor: "#1d4ed8",
      iconBg: "#bfdbfe",
    },
    email: {
      bgGradient: "linear-gradient(to bottom right, #fce7f3, #fdf2f8)",
      borderColor: "#f472b6",
      accentColor: "#be185d",
      iconBg: "#fbcfe8",
    },
    code: {
      bgGradient: "linear-gradient(to bottom right, #f3f4f6, #f9fafb)",
      borderColor: "#9ca3af",
      accentColor: "#374151",
      iconBg: "#e5e7eb",
    },
  }

  const s = styleMap[type] ?? styleMap.otp

  return {
    container: `
      border-radius: 24px;
      padding: 32px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${s.bgGradient};
      border: 3px dashed ${s.borderColor};
    `.replace(/\s+/g, " ").trim(),
    innerWrapper: `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    `.replace(/\s+/g, " ").trim(),
    iconWrapper: `
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: ${s.iconBg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      line-height: 1;
    `.replace(/\s+/g, " ").trim(),
    label: `
      font-size: 12px;
      font-weight: 700;
      color: ${s.accentColor};
      text-transform: uppercase;
      letter-spacing: 2px;
    `.replace(/\s+/g, " ").trim(),
    codeBox: `
      font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.3em;
      color: #111827;
      background: rgba(255, 255, 255, 0.9);
      padding: 16px 32px;
      border-radius: 16px;
      border: 2px solid #e5e7eb;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
      margin: 8px 0;
    `.replace(/\s+/g, " ").trim(),
    copyHint: `
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    `.replace(/\s+/g, " ").trim(),
    expiry: `
      font-size: 13px;
      color: #ef4444;
      font-weight: 500;
      margin-top: 8px;
    `.replace(/\s+/g, " ").trim(),
  }
}

export default SensitiveCodeNode
