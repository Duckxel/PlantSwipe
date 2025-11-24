import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export const VariableHighlighter = Extension.create({
  name: 'variableHighlighter',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText) return
              const text = node.text || ''
              let match: RegExpExecArray | null
              while ((match = VARIABLE_REGEX.exec(text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'tiptap-variable-token',
                  }),
                )
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
