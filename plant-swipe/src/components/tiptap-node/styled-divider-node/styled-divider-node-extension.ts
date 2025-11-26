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
    const dividerHtml = getDividerHTML(style, color)

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
      dividerHtml,
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

function getDividerHTML(style: DividerStyle, color: string): string {
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
      return `<div style="display: flex; justify-content: center; gap: 12px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.secondary};"></span><span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.primary};"></span><span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.secondary};"></span></div>`
    case "fancy":
      return `<div style="display: flex; align-items: center; gap: 16px;"><div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, ${colors.primary});"></div><div style="font-size: 20px;">✦</div><div style="flex: 1; height: 1px; background: linear-gradient(90deg, ${colors.primary}, transparent);"></div></div>`
    case "wave":
      return `<div style="height: 20px; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 120\" preserveAspectRatio=\"none\"><path d=\"M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60\" fill=\"none\" stroke=\"${encodeURIComponent(colors.primary)}\" stroke-width=\"2\"/></svg>') repeat-x center / 200px 20px;"></div>`
    case "stars":
      return `<div style="display: flex; justify-content: center; gap: 8px; color: ${colors.primary}; font-size: 12px;">✦ ✦ ✦ ✦ ✦</div>`
    case "solid":
    default:
      return `<div style="height: 2px; background: ${colors.primary}; opacity: 0.3; border-radius: 1px;"></div>`
  }
}

export default StyledDividerNode
