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
    border-radius: 16px;
    padding: 20px 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `.replace(/\s+/g, " ").trim()

  const styleMap: Record<CardStyle, { bg: string; border: string; iconBg: string }> = {
    default: {
      bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      iconBg: "rgba(16, 185, 129, 0.15)",
    },
    highlight: {
      bg: "linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(251, 191, 36, 0.3)",
      iconBg: "rgba(251, 191, 36, 0.2)",
    },
    code: {
      bg: "linear-gradient(135deg, rgba(55, 65, 81, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(55, 65, 81, 0.2)",
      iconBg: "rgba(55, 65, 81, 0.12)",
    },
    warning: {
      bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(239, 68, 68, 0.2)",
      iconBg: "rgba(239, 68, 68, 0.15)",
    },
    success: {
      bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(16, 185, 129, 0.25)",
      iconBg: "rgba(16, 185, 129, 0.2)",
    },
    info: {
      bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)",
      border: "1px solid rgba(59, 130, 246, 0.2)",
      iconBg: "rgba(59, 130, 246, 0.15)",
    },
  }

  const s = styleMap[style]

  return {
    container: `${baseContainer} background: ${s.bg}; border: ${s.border};`,
    table: "width: 100%; border-collapse: collapse;",
    iconCell: `
      width: 56px;
      vertical-align: top;
      padding-right: 16px;
    `.replace(/\s+/g, " ").trim(),
    iconBox: `
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: ${s.iconBg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    `.replace(/\s+/g, " ").trim(),
    contentCell: "vertical-align: top;",
    title: "display: block; font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;",
    content: "font-size: 15px; color: #4b5563; line-height: 1.5;",
  }
}

export default EmailCardNode
