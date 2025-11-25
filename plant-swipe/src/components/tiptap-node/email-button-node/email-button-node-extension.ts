import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { EmailButtonNode as EmailButtonNodeComponent } from "./email-button-node"

export type ButtonStyle = "primary" | "secondary" | "outline" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

export interface EmailButtonNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface EmailButtonAttributes {
  text: string
  url: string
  style: ButtonStyle
  size: ButtonSize
  align: "left" | "center" | "right"
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    emailButton: {
      setEmailButton: (options?: Partial<EmailButtonAttributes>) => ReturnType
    }
  }
}

export const EmailButtonNode = Node.create<EmailButtonNodeOptions>({
  name: "emailButton",

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
      text: {
        default: "Click Here",
      },
      url: {
        default: "",
      },
      style: {
        default: "primary" as ButtonStyle,
      },
      size: {
        default: "md" as ButtonSize,
      },
      align: {
        default: "center" as const,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="email-button"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { text, url, style, size, align } = HTMLAttributes as EmailButtonAttributes

    // Generate inline styles for email compatibility
    const buttonStyles = getButtonInlineStyles(style, size)
    const alignStyle = `text-align: ${align};`

    return [
      "div",
      mergeAttributes(
        { "data-type": "email-button", style: `${alignStyle} padding: 16px 0;` },
        this.options.HTMLAttributes
      ),
      [
        "a",
        {
          href: url || "#",
          style: buttonStyles,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        text || "Click Here",
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailButtonNodeComponent)
  },

  addCommands() {
    return {
      setEmailButton:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              text: options?.text ?? "Click Here",
              url: options?.url ?? "",
              style: options?.style ?? "primary",
              size: options?.size ?? "md",
              align: options?.align ?? "center",
            },
          })
        },
    }
  },
})

function getButtonInlineStyles(style: ButtonStyle, size: ButtonSize): string {
  const baseStyles = `
    display: inline-block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 600;
    text-decoration: none;
    border-radius: 50px;
    transition: all 0.2s;
  `.replace(/\s+/g, " ").trim()

  const sizeStyles: Record<ButtonSize, string> = {
    sm: "padding: 10px 24px; font-size: 14px;",
    md: "padding: 14px 32px; font-size: 16px;",
    lg: "padding: 18px 44px; font-size: 18px;",
  }

  const styleVariants: Record<ButtonStyle, string> = {
    primary: `
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #ffffff;
      box-shadow: 0 10px 30px -5px rgba(16, 185, 129, 0.4);
    `,
    secondary: `
      background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
      color: #ffffff;
      box-shadow: 0 10px 30px -5px rgba(55, 65, 81, 0.3);
    `,
    outline: `
      background: transparent;
      color: #059669;
      border: 2px solid #059669;
    `,
    ghost: `
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
    `,
  }

  return `${baseStyles} ${sizeStyles[size]} ${styleVariants[style]}`.replace(/\s+/g, " ").trim()
}

export default EmailButtonNode
