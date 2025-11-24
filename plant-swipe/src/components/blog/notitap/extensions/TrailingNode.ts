import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { Node as ProseMirrorNode, NodeType } from 'prosemirror-model'

const nodeEqualsType = (node: ProseMirrorNode, types: NodeType | NodeType[]) => {
  if (Array.isArray(types)) {
    return types.includes(node.type)
  }
  return node.type === types
}

export interface TrailingNodeOptions {
  node: string
  notAfter: string[]
}

export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: 'trailingNode',

  addOptions() {
    return {
      node: 'paragraph',
      notAfter: ['paragraph'],
    }
  },

  addProseMirrorPlugins() {
    const key = new PluginKey(this.name)
    return [
      new Plugin({
        key,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state
          const shouldInsert = key.getState(state)
          if (!shouldInsert) {
            return null
          }

          const type = schema.nodes[this.options.node]
          if (!type) return null

          const endPosition = doc.content.size
          return tr.insert(endPosition, type.create())
        },
        state: {
          init: (_, state) => {
            const lastNode = state.doc.lastChild
            if (!lastNode) return true
            const forbidden = this.options.notAfter
              .map((name) => state.schema.nodes[name])
              .filter(Boolean) as NodeType[]
            return !nodeEqualsType(lastNode, forbidden)
          },
          apply: (tr, value, _, newState) => {
            if (!tr.docChanged) return value
            const lastNode = newState.doc.lastChild
            if (!lastNode) return true
            const forbidden = this.options.notAfter
              .map((name) => newState.schema.nodes[name])
              .filter(Boolean) as NodeType[]
            return !nodeEqualsType(lastNode, forbidden)
          },
        },
      }),
    ]
  },
})

