import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { NodeSelection } from "@tiptap/pm/state"

export interface GlobalDragHandleOptions {
  /**
   * Node types to exclude from drag handles
   * @default ["doc", "text", "hardBreak"]
   */
  excludeNodes?: string[]
  /**
   * Whether the extension is enabled
   * @default true
   */
  enabled?: boolean
}

export const GlobalDragHandlePluginKey = new PluginKey("globalDragHandle")

/**
 * GlobalDragHandle Extension
 * 
 * This extension enables drag-and-drop for all block nodes in the editor.
 * Combined with the CSS styles, it shows a drag handle on the left side
 * of each block when hovered.
 * 
 * The drag handles are added via CSS ::before pseudo-elements on block nodes,
 * and this extension handles the drag-and-drop logic.
 */
export const GlobalDragHandle = Extension.create<GlobalDragHandleOptions>({
  name: "globalDragHandle",

  addOptions() {
    return {
      excludeNodes: ["doc", "text", "hardBreak"],
      enabled: true,
    }
  },

  addProseMirrorPlugins() {
    const { enabled } = this.options

    if (!enabled) return []

    return [
      new Plugin({
        key: GlobalDragHandlePluginKey,
        props: {
          handleDOMEvents: {
            // Handle mousedown on the drag handle area
            mousedown: (view, event) => {
              const target = event.target as HTMLElement
              
              // Check if clicking on the drag handle area (left edge of block)
              if (!target.closest('.ProseMirror')) return false
              
              // Get the element's position relative to editor
              const editorRect = view.dom.getBoundingClientRect()
              const clickX = event.clientX - editorRect.left
              
              // If clicking in the left margin area (drag handle zone)
              if (clickX < 30 && clickX > 0) {
                // Find the block node at this position
                const pos = view.posAtCoords({ left: event.clientX + 50, top: event.clientY })
                if (!pos) return false

                const $pos = view.state.doc.resolve(pos.pos)
                const depth = $pos.depth

                // Find the top-level block node
                let nodePos = pos.pos
                for (let d = depth; d > 0; d--) {
                  if ($pos.node(d).isBlock && $pos.start(d) > 0) {
                    nodePos = $pos.before(d)
                    break
                  }
                }

                const node = view.state.doc.nodeAt(nodePos)
                if (!node || !node.isBlock) return false

                // Select the node for dragging
                const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
                view.dispatch(tr)

                // Add visual feedback
                event.preventDefault()
                return true
              }

              return false
            },
          },
        },
      }),
    ]
  },

  // Make common block nodes draggable by extending their schema
  extendNodeSchema(extension) {
    const { excludeNodes } = this.options
    
    // Skip excluded nodes
    if (excludeNodes?.includes(extension.name)) {
      return {}
    }

    return {
      draggable: extension.config?.draggable ?? true,
    }
  },
})

export default GlobalDragHandle
