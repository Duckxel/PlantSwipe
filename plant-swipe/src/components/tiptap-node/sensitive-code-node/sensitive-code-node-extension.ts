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
  // Email-compatible styles - no flexbox, no gradients, no box-shadow
  // Many email clients don't support these CSS features
  const styleMap: Record<CodeType, { bg: string; borderColor: string; accentColor: string; iconBg: string }> = {
    otp: {
      bg: "#fef3c7", // Solid amber background
      borderColor: "#fbbf24",
      accentColor: "#b45309",
      iconBg: "#fde68a",
    },
    verification: {
      bg: "#d1fae5", // Solid green background
      borderColor: "#34d399",
      accentColor: "#047857",
      iconBg: "#a7f3d0",
    },
    password: {
      bg: "#ede9fe", // Solid purple background
      borderColor: "#a78bfa",
      accentColor: "#6d28d9",
      iconBg: "#ddd6fe",
    },
    link: {
      bg: "#dbeafe", // Solid blue background
      borderColor: "#60a5fa",
      accentColor: "#1d4ed8",
      iconBg: "#bfdbfe",
    },
    email: {
      bg: "#fce7f3", // Solid pink background
      borderColor: "#f472b6",
      accentColor: "#be185d",
      iconBg: "#fbcfe8",
    },
    code: {
      bg: "#f3f4f6", // Solid gray background
      borderColor: "#9ca3af",
      accentColor: "#374151",
      iconBg: "#e5e7eb",
    },
  }

  const s = styleMap[type] ?? styleMap.otp

  return {
    container: `
      border-radius: 16px;
      padding: 28px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: ${s.bg};
      border: 3px dashed ${s.borderColor};
    `.replace(/\s+/g, " ").trim(),
    // Use table-based centering instead of flexbox for email compatibility
    innerWrapper: "text-align: center;",
    iconWrapper: `
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background-color: ${s.iconBg};
      font-size: 28px;
      line-height: 56px;
      text-align: center;
      margin: 0 auto 12px auto;
    `.replace(/\s+/g, " ").trim(),
    label: `
      font-size: 12px;
      font-weight: 700;
      color: ${s.accentColor};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
    `.replace(/\s+/g, " ").trim(),
    codeBox: `
      font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: #111827;
      background-color: #ffffff;
      padding: 14px 28px;
      border-radius: 12px;
      border: 2px solid #e5e7eb;
      display: inline-block;
      margin: 8px 0;
    `.replace(/\s+/g, " ").trim(),
    copyHint: `
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
    `.replace(/\s+/g, " ").trim(),
    expiry: `
      font-size: 13px;
      color: #ef4444;
      font-weight: 500;
      margin-top: 12px;
    `.replace(/\s+/g, " ").trim(),
  }
}

export default SensitiveCodeNode
