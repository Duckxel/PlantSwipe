import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { CollapsibleNode as CollapsibleNodeComponent } from "./collapsible-node"
import { shouldStopNodeViewEvent } from "@/lib/tiptap-utils"

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

  // Allow any block content: paragraphs, headings, lists, blockquotes, code blocks, images, etc.
  // Using "block+" allows all registered block nodes
  content: "block+",

  // Allow dragging via the drag handle
  draggable: true,

  // Must be true for dragging to work - the drag handle requires node selection
  selectable: true,

  // IMPORTANT: Must be false to allow editing inside the node
  atom: false,

  // Keep false to allow normal editing operations inside
  defining: false,

  // Keep false to allow content to be edited normally
  // The selectable: false setting should prevent the whole node from being selected
  isolating: false,

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
    const { title, style } = HTMLAttributes as CollapsibleAttributes
    // Note: isOpen is intentionally not used here - rendered HTML always starts collapsed
    // The isOpen attribute only controls the editor view, not the final rendered output

    // Use CSS classes for styling so dark mode works via CSS
    // Inline styles are used as fallback for email clients
    const styleClass = `collapsible-${style || "default"}`

    return [
      "details",
      mergeAttributes(
        {
          "data-type": "collapsible",
          "data-collapsible-style": style || "default",
          class: `collapsible-block ${styleClass}`,
          // No 'open' attribute - always starts collapsed in rendered view
        },
        this.options.HTMLAttributes
      ),
      [
        "summary",
        { class: "collapsible-summary" },
        [
          "span",
          { class: "collapsible-icon" },
          "▶", // Arrow pointing right (collapsed state)
        ],
        [
          "span",
          { class: "collapsible-title" },
          title || "Section title",
        ],
      ],
      [
        "div",
        { class: "collapsible-content", "data-collapsible-content": "true" },
        0, // This is where nested content goes
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleNodeComponent, {
      stopEvent: ({ event }) => shouldStopNodeViewEvent(event),
    })
  },

  addCommands() {
    return {
      setCollapsible:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: options?.title ?? "Section title",
              isOpen: options?.isOpen ?? true, // Open by default in editor for editing
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

  // No custom keyboard shortcuts needed - all shortcuts should work normally inside
  // the collapsible content area since we're using NodeViewContent
})

export default CollapsibleNode
