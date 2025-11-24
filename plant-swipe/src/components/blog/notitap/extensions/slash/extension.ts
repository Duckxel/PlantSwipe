import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

export const SlashCommands = Extension.create({
  name: 'slash-commands',
  addOptions() {
    return {
      suggestion: {},
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

