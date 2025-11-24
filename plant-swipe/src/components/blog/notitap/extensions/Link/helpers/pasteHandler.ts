import type { Editor } from '@tiptap/core'
import { find } from 'linkifyjs'
import type { MarkType } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'

type PasteHandlerOptions = {
  editor: Editor
  type: MarkType
}

export function pasteHandler(options: PasteHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('handlePasteLink'),
    props: {
      handlePaste: (_view, event, slice) => {
        const { state } = options.editor
        if (state.selection.empty) {
          return false
        }

        let textContent = ''
        slice.content.forEach((node) => {
          textContent += node.textContent
        })

        const link = find(textContent).find(
          (item) => item.isLink && item.value === textContent,
        )

        if (!textContent || !link) {
          return false
        }

        options.editor.commands.setMark(options.type, {
          href: link.href,
        })

        return true
      },
    },
  })
}

