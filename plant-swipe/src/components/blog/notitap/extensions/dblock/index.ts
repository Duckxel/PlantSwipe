import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { Node as ProseMirrorNode, NodeType } from 'prosemirror-model'

import { DBlockNodeView } from './DBlockNodeView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dBlock: {
      setDBlock: (position?: number) => ReturnType
    }
  }
}

const hasNonDBlockChild = (doc: ProseMirrorNode, dBlockType?: NodeType) => {
  if (!dBlockType) return false
  let needsWrap = false
  doc.forEach((node) => {
    if (!needsWrap && node.type !== dBlockType) {
      needsWrap = true
    }
  })
  return needsWrap
}

export const DBlock = Node.create({
  name: 'dBlock',
  group: 'block',
  content: 'block',
  draggable: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="d-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'd-block' }), 0]
  },

  addCommands() {
    return {
      setDBlock:
        (position?: number) =>
        ({ state, chain }) => {
          const pos = position ?? state.selection.from
          return chain()
            .insertContentAt(pos, {
              type: this.name,
              content: [{ type: 'paragraph' }],
            })
            .focus(pos + 2)
            .run()
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(DBlockNodeView)
  },

  addProseMirrorPlugins() {
    const key = new PluginKey('notitap-dblock-wrapper')

    return [
      new Plugin({
        key,
        state: {
          init(_, state) {
            return {
              shouldWrap: hasNonDBlockChild(state.doc, state.schema.nodes.dBlock),
            }
          },
          apply(tr, value, _, newState) {
            if (tr.getMeta('notitapWrapped')) {
              return { shouldWrap: false }
            }
            if (!tr.docChanged) {
              return value
            }
            return {
              shouldWrap: hasNonDBlockChild(
                newState.doc,
                newState.schema.nodes.dBlock,
              ),
            }
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          const pluginState = key.getState(newState)
          const docChanged = transactions.some((transaction) => transaction.docChanged)
          if (!docChanged && !pluginState?.shouldWrap) {
            return null
          }

          const dBlockType = newState.schema.nodes.dBlock
          if (!dBlockType) return null

          const { doc } = newState
          let needWrap = false
          let pos = 0
          const tr = newState.tr

          doc.forEach((node) => {
            if (node.type !== dBlockType) {
              needWrap = true
              const wrapper = dBlockType.create({}, node)
              tr.replaceWith(pos, pos + node.nodeSize, wrapper)
              pos += wrapper.nodeSize
            } else {
              pos += node.nodeSize
            }
          })

          if (!needWrap) {
            return null
          }

          tr.setMeta('notitapWrapped', true)
          return tr
        },
      }),
    ]
  },
})

