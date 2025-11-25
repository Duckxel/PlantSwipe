import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { EmailCardNode as EmailCardNodeComponent } from "./email-card-node"

export type CardStyle = "default" | "highlight" | "code" | "warning" | "success" | "info"

export interface EmailCardNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface EmailCardAttributes {
  title: string
  content: string
  style: CardStyle
  icon: string
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    emailCard: {
      setEmailCard: (options?: Partial<EmailCardAttributes>) => ReturnType
    }
  }
}

export const EmailCardNode = Node.create<EmailCardNodeOptions>({
  name: "emailCard",

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
      title: {
        default: "",
      },
      content: {
        default: "",
      },
      style: {
        default: "default" as CardStyle,
      },
      icon: {
        default: "📌",
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="email-card"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { title, content, style, icon } = HTMLAttributes as EmailCardAttributes
    const styles = getCardStyles(style)

    return [
      "div",
      mergeAttributes(
        { 
          "data-type": "email-card",
          style: `${styles.container} margin: 24px 0;`,
        },
        this.options.HTMLAttributes
      ),
      [
        "table",
        { 
          role: "presentation", 
          cellpadding: "0", 
          cellspacing: "0", 
          width: "100%",
          style: styles.table,
        },
        [
          "tr",
          {},
          [
            "td",
            { style: styles.iconCell },
            icon,
          ],
          [
            "td",
            { style: styles.contentCell },
            [
              "div",
              {},
              title ? ["strong", { style: styles.title }, title] : "",
              content ? ["div", { style: styles.content }, content] : "",
            ],
          ],
        ],
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailCardNodeComponent)
  },

  addCommands() {
    return {
      setEmailCard:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: options?.title ?? "",
              content: options?.content ?? "Your content here",
              style: options?.style ?? "default",
              icon: options?.icon ?? "📌",
            },
          })
        },
    }
  },
})

function getCardStyles(style: CardStyle): Record<string, string> {
  const baseContainer = `
    border-radius: 20px;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `.replace(/\s+/g, " ").trim()

  const styleMap: Record<CardStyle, { bg: string; border: string; shadow: string; titleColor: string }> = {
    default: {
      bg: "linear-gradient(145deg, rgba(16, 185, 129, 0.12) 0%, #ffffff 40%, rgba(16, 185, 129, 0.06) 100%)",
      border: "2px solid rgba(16, 185, 129, 0.25)",
      shadow: "0 8px 32px rgba(16, 185, 129, 0.15), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#065f46",
    },
    highlight: {
      bg: "linear-gradient(145deg, rgba(251, 191, 36, 0.15) 0%, #ffffff 40%, rgba(251, 191, 36, 0.08) 100%)",
      border: "2px solid rgba(251, 191, 36, 0.35)",
      shadow: "0 8px 32px rgba(251, 191, 36, 0.18), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#92400e",
    },
    code: {
      bg: "linear-gradient(145deg, rgba(55, 65, 81, 0.08) 0%, #ffffff 40%, rgba(55, 65, 81, 0.04) 100%)",
      border: "2px solid rgba(55, 65, 81, 0.2)",
      shadow: "0 8px 32px rgba(55, 65, 81, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#1f2937",
    },
    warning: {
      bg: "linear-gradient(145deg, rgba(239, 68, 68, 0.1) 0%, #ffffff 40%, rgba(239, 68, 68, 0.05) 100%)",
      border: "2px solid rgba(239, 68, 68, 0.25)",
      shadow: "0 8px 32px rgba(239, 68, 68, 0.15), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#b91c1c",
    },
    success: {
      bg: "linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, #ffffff 40%, rgba(16, 185, 129, 0.08) 100%)",
      border: "2px solid rgba(16, 185, 129, 0.3)",
      shadow: "0 8px 32px rgba(16, 185, 129, 0.18), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#047857",
    },
    info: {
      bg: "linear-gradient(145deg, rgba(59, 130, 246, 0.1) 0%, #ffffff 40%, rgba(59, 130, 246, 0.05) 100%)",
      border: "2px solid rgba(59, 130, 246, 0.25)",
      shadow: "0 8px 32px rgba(59, 130, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.04)",
      titleColor: "#1d4ed8",
    },
  }

  const s = styleMap[style]

  return {
    container: `${baseContainer} background: ${s.bg}; border: ${s.border}; box-shadow: ${s.shadow};`,
    table: "width: 100%; border-collapse: collapse;",
    iconCell: `
      width: 56px;
      vertical-align: top;
      padding-right: 16px;
    `.replace(/\s+/g, " ").trim(),
    iconBox: `
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    `.replace(/\s+/g, " ").trim(),
    contentCell: "vertical-align: top;",
    title: `display: block; font-size: 17px; font-weight: 700; color: ${s.titleColor}; margin-bottom: 6px; letter-spacing: -0.3px;`,
    content: "font-size: 15px; color: #374151; line-height: 1.6;",
  }
}

export default EmailCardNode
