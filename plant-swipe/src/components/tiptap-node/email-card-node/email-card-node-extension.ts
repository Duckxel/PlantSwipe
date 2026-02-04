import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { EmailCardNode as EmailCardNodeComponent } from "./email-card-node"
import { shouldStopNodeViewEvent } from "@/lib/tiptap-utils"

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
        parseHTML: (element: HTMLElement) => {
          // Extract title from the <strong> element inside
          const strong = element.querySelector("strong")
          return strong?.textContent || ""
        },
      },
      content: {
        default: "",
        parseHTML: (element: HTMLElement) => {
          // Extract content from the nested div (second child of the content wrapper)
          const contentDiv = element.querySelector("td:last-child > div > div")
          return contentDiv?.textContent || ""
        },
      },
      style: {
        default: "default" as CardStyle,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-card-style") as CardStyle) || "default"
        },
      },
      icon: {
        default: "📌",
        parseHTML: (element: HTMLElement) => {
          // Extract icon from the first <td> element
          const iconCell = element.querySelector("td:first-child")
          return iconCell?.textContent?.trim() || "📌"
        },
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
          "data-card-style": style || "default",
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
    return ReactNodeViewRenderer(EmailCardNodeComponent, {
      stopEvent: ({ event }) => shouldStopNodeViewEvent(event),
    })
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
  // Email-compatible styles - using solid colors instead of gradients
  // Many email clients don't support: linear-gradient, box-shadow, rgba() colors
  const baseContainer = `
    border-radius: 16px;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `.replace(/\s+/g, " ").trim()

  // Use solid, web-safe colors for maximum email client compatibility
  const styleMap: Record<CardStyle, { bg: string; border: string; titleColor: string; iconBg: string }> = {
    default: {
      bg: "#ecfdf5", // Light emerald
      border: "2px solid #10b981",
      titleColor: "#065f46",
      iconBg: "#d1fae5",
    },
    highlight: {
      bg: "#fffbeb", // Light amber
      border: "2px solid #f59e0b",
      titleColor: "#92400e",
      iconBg: "#fef3c7",
    },
    code: {
      bg: "#f9fafb", // Light gray
      border: "2px solid #6b7280",
      titleColor: "#1f2937",
      iconBg: "#e5e7eb",
    },
    warning: {
      bg: "#fef2f2", // Light red
      border: "2px solid #ef4444",
      titleColor: "#b91c1c",
      iconBg: "#fee2e2",
    },
    success: {
      bg: "#ecfdf5", // Light green
      border: "2px solid #22c55e",
      titleColor: "#047857",
      iconBg: "#dcfce7",
    },
    info: {
      bg: "#eff6ff", // Light blue
      border: "2px solid #3b82f6",
      titleColor: "#1d4ed8",
      iconBg: "#dbeafe",
    },
  }

  // Fallback to 'default' if style is undefined or not in the map
  const s = styleMap[style] ?? styleMap.default

  return {
    container: `${baseContainer} background-color: ${s.bg}; border: ${s.border};`,
    table: "width: 100%; border-collapse: collapse;",
    iconCell: "width: 56px; vertical-align: top; padding-right: 16px; font-size: 28px;",
    iconBox: `
      width: 48px;
      height: 48px;
      border-radius: 14px;
      text-align: center;
      line-height: 48px;
      font-size: 28px;
      background-color: ${s.iconBg};
    `.replace(/\s+/g, " ").trim(),
    contentCell: "vertical-align: top;",
    title: `display: block; font-size: 17px; font-weight: 700; color: ${s.titleColor}; margin-bottom: 6px;`,
    content: "font-size: 15px; color: #374151; line-height: 1.6;",
  }
}

export default EmailCardNode
