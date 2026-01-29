import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { CollapsibleNode as CollapsibleNodeComponent } from "./collapsible-node"

export type CollapsibleStyle = "default" | "info" | "tip" | "warning" | "note"

export interface CollapsibleNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface CollapsibleAttributes {
  title: string
  isOpen: boolean
  style: CollapsibleStyle
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    collapsible: {
      setCollapsible: (options?: Partial<CollapsibleAttributes>) => ReturnType
      toggleCollapsibleOpen: () => ReturnType
    }
  }
}

export const CollapsibleNode = Node.create<CollapsibleNodeOptions>({
  name: "collapsible",

  group: "block",

  content: "block+",

  draggable: true,

  selectable: true,

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      title: {
        default: "Click to expand",
        parseHTML: (element: HTMLElement) => {
          const summary = element.querySelector("summary")
          return summary?.textContent?.trim() || "Click to expand"
        },
      },
      isOpen: {
        default: false,
        parseHTML: (element: HTMLElement) => {
          return element.hasAttribute("open")
        },
      },
      style: {
        default: "default" as CollapsibleStyle,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-collapsible-style") as CollapsibleStyle) || "default"
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'details[data-type="collapsible"]' },
      { tag: 'div[data-type="collapsible"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { title, isOpen, style } = HTMLAttributes as CollapsibleAttributes
    const styles = getCollapsibleStyles(style)

    // For email compatibility, use a details/summary structure that degrades gracefully
    // Most email clients will show the content expanded since they don't support details
    return [
      "details",
      mergeAttributes(
        {
          "data-type": "collapsible",
          "data-collapsible-style": style || "default",
          ...(isOpen ? { open: "true" } : {}),
          style: styles.container,
        },
        this.options.HTMLAttributes
      ),
      [
        "summary",
        { style: styles.summary },
        [
          "span",
          { style: styles.icon },
          isOpen ? "▼" : "▶",
        ],
        [
          "span",
          { style: styles.title },
          title || "Click to expand",
        ],
      ],
      [
        "div",
        { style: styles.content, "data-collapsible-content": "true" },
        0, // This is where nested content goes
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleNodeComponent)
  },

  addCommands() {
    return {
      setCollapsible:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: options?.title ?? "Click to expand",
              isOpen: options?.isOpen ?? true,
              style: options?.style ?? "default",
            },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Add your content here..." }],
              },
            ],
          })
        },
      toggleCollapsibleOpen:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state
          const node = state.doc.nodeAt(selection.from)
          if (node?.type.name === this.name && dispatch) {
            const tr = state.tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              isOpen: !node.attrs.isOpen,
            })
            dispatch(tr)
            return true
          }
          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Allow Enter to create new paragraph inside collapsible
      Enter: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're inside a collapsible node
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) {
            // We're inside a collapsible, let default behavior handle it
            return false
          }
        }
        return false
      },
    }
  },
})

function getCollapsibleStyles(style: CollapsibleStyle): Record<string, string> {
  // Email-compatible styles using solid colors
  const baseContainer = `
    border-radius: 12px;
    margin: 16px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  `.replace(/\s+/g, " ").trim()

  const styleMap: Record<CollapsibleStyle, { bg: string; border: string; summaryBg: string; accentColor: string }> = {
    default: {
      bg: "#f9fafb",
      border: "1px solid #e5e7eb",
      summaryBg: "#f3f4f6",
      accentColor: "#374151",
    },
    info: {
      bg: "#eff6ff",
      border: "1px solid #bfdbfe",
      summaryBg: "#dbeafe",
      accentColor: "#1d4ed8",
    },
    tip: {
      bg: "#ecfdf5",
      border: "1px solid #a7f3d0",
      summaryBg: "#d1fae5",
      accentColor: "#047857",
    },
    warning: {
      bg: "#fffbeb",
      border: "1px solid #fde68a",
      summaryBg: "#fef3c7",
      accentColor: "#b45309",
    },
    note: {
      bg: "#faf5ff",
      border: "1px solid #e9d5ff",
      summaryBg: "#f3e8ff",
      accentColor: "#7c3aed",
    },
  }

  const s = styleMap[style] ?? styleMap.default

  return {
    container: `${baseContainer} background-color: ${s.bg}; border: ${s.border};`,
    summary: `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      background-color: ${s.summaryBg};
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      color: ${s.accentColor};
      list-style: none;
    `.replace(/\s+/g, " ").trim(),
    icon: `
      font-size: 10px;
      color: ${s.accentColor};
      transition: transform 0.2s ease;
    `.replace(/\s+/g, " ").trim(),
    title: `
      flex: 1;
      font-size: 15px;
    `.replace(/\s+/g, " ").trim(),
    content: `
      padding: 16px;
      border-top: 1px solid ${s.border.split(' ').pop()};
    `.replace(/\s+/g, " ").trim(),
  }
}

export default CollapsibleNode
