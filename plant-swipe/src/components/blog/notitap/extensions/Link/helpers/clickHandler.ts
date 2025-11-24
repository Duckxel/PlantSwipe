import { getAttributes } from '@tiptap/core'
import type { MarkType } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'

type ClickHandlerOptions = {
  type: MarkType
}

export function clickHandler(options: ClickHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('handleClickLink'),
    props: {
      handleClick: (view, _pos, event) => {
        const attrs = getAttributes(view.state, options.type.name)
        const link = (event.target as HTMLElement | null)?.closest('a')

        if (link && attrs.href) {
          window.open(attrs.href, attrs.target)
          return true
        }

        return false
      },
    },
  })
}

