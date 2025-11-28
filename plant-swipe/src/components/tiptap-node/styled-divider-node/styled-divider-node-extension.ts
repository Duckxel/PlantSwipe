import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { StyledDividerNode as StyledDividerNodeComponent } from "./styled-divider-node"

export type DividerStyle = "solid" | "gradient" | "dashed" | "dots" | "fancy" | "wave" | "stars"

export interface StyledDividerNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface StyledDividerAttributes {
  style: DividerStyle
  color: string
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    styledDivider: {
      setStyledDivider: (options?: Partial<StyledDividerAttributes>) => ReturnType
    }
  }
}

export const StyledDividerNode = Node.create<StyledDividerNodeOptions>({
  name: "styledDivider",

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
      style: {
        default: "gradient" as DividerStyle,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-style") as DividerStyle) || "gradient"
        },
      },
      color: {
        default: "emerald",
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute("data-color") || "emerald"
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="styled-divider"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { style, color } = HTMLAttributes as StyledDividerAttributes
    const dividerStyle = getDividerStyle(style, color)

    // Return proper DOM structure instead of HTML string to avoid escaping
    return [
      "div",
      mergeAttributes(
        { 
          "data-type": "styled-divider",
          "data-style": style,
          "data-color": color,
          style: "padding: 24px 0; text-align: center;",
        },
        this.options.HTMLAttributes
      ),
      ["div", { style: dividerStyle }],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(StyledDividerNodeComponent)
  },

  addCommands() {
    return {
      setStyledDivider:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              style: options?.style ?? "gradient",
              color: options?.color ?? "emerald",
            },
          })
        },
    }
  },
})

// Returns inline style string for the inner div (for simple line-based dividers)
function getDividerStyle(style: DividerStyle, color: string): string {
  const colorMap: Record<string, { primary: string; secondary: string }> = {
    emerald: { primary: "#059669", secondary: "#34d399" },
    blue: { primary: "#2563eb", secondary: "#60a5fa" },
    purple: { primary: "#7c3aed", secondary: "#a78bfa" },
    pink: { primary: "#db2777", secondary: "#f472b6" },
    amber: { primary: "#d97706", secondary: "#fbbf24" },
    gray: { primary: "#4b5563", secondary: "#9ca3af" },
  }

  const colors = colorMap[color] || colorMap.emerald

  switch (style) {
    case "gradient":
      return `height: 3px; background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent); border-radius: 2px;`
    case "dashed":
      return `height: 2px; border-top: 2px dashed ${colors.primary}; opacity: 0.5;`
    case "dots":
      // For dots, we use a centered layout with bullet characters (email-safe)
      return `height: 16px; line-height: 16px; text-align: center; font-size: 24px; color: ${colors.primary}; letter-spacing: 12px;`
    case "fancy":
      // For fancy, use a simple centered line with emoji (email-safe)
      return `height: 3px; background: linear-gradient(90deg, transparent 0%, ${colors.primary} 20%, transparent 50%, ${colors.primary} 80%, transparent 100%); border-radius: 2px;`
    case "wave":
      // Simplified wave - gradient line (email-safe)
      return `height: 4px; background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent); border-radius: 2px;`
    case "stars":
      // For stars, use letter-spacing and color
      return `height: 20px; line-height: 20px; text-align: center; font-size: 14px; color: ${colors.primary}; letter-spacing: 6px;`
    case "solid":
    default:
      return `height: 2px; background: ${colors.primary}; opacity: 0.3; border-radius: 1px;`
  }
}

// Returns full HTML string for email export (used by post-processing)
export function getDividerHTML(style: DividerStyle, color: string): string {
  const colorMap: Record<string, { primary: string; secondary: string }> = {
    emerald: { primary: "#059669", secondary: "#34d399" },
    blue: { primary: "#2563eb", secondary: "#60a5fa" },
    purple: { primary: "#7c3aed", secondary: "#a78bfa" },
    pink: { primary: "#db2777", secondary: "#f472b6" },
    amber: { primary: "#d97706", secondary: "#fbbf24" },
    gray: { primary: "#4b5563", secondary: "#9ca3af" },
  }

  const colors = colorMap[color] || colorMap.emerald

  switch (style) {
    case "gradient":
      return `<div style="height: 3px; background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent); border-radius: 2px;"></div>`
    case "dashed":
      return `<div style="height: 2px; border-top: 2px dashed ${colors.primary}; opacity: 0.5;"></div>`
    case "dots":
      return `<div style="text-align: center; font-size: 24px; color: ${colors.primary}; letter-spacing: 12px;">• • •</div>`
    case "fancy":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0;"><tr><td style="width: 40%; height: 1px; background: linear-gradient(90deg, transparent, ${colors.primary});"></td><td style="width: 20%; text-align: center; font-size: 20px;">✦</td><td style="width: 40%; height: 1px; background: linear-gradient(90deg, ${colors.primary}, transparent);"></td></tr></table>`
    case "wave":
      return `<div style="height: 4px; background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent); border-radius: 2px;"></div>`
    case "stars":
      return `<div style="text-align: center; font-size: 14px; color: ${colors.primary}; letter-spacing: 6px;">✦ ✦ ✦ ✦ ✦</div>`
    case "solid":
    default:
      return `<div style="height: 2px; background: ${colors.primary}; opacity: 0.3; border-radius: 1px;"></div>`
  }
}

export default StyledDividerNode
