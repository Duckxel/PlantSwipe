import { Mark, markPasteRule, mergeAttributes } from '@tiptap/core'
import { find, registerCustomProtocol } from 'linkifyjs'

import { autolink } from './helpers/autolink'
import { clickHandler } from './helpers/clickHandler'
import { pasteHandler } from './helpers/pasteHandler'

export interface NotitapLinkOptions {
  autolink: boolean
  protocols: string[]
  openOnClick: boolean
  linkOnPaste: boolean
  HTMLAttributes: Record<string, any>
  validate?: (url: string) => boolean
  onModKPressed?: () => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    notitapLink: {
      setLink: (attributes: { href: string; target?: string }) => ReturnType
      toggleLink: (attributes: { href: string; target?: string }) => ReturnType
      unsetLink: () => ReturnType
    }
  }
}

export const NotitapLink = Mark.create<NotitapLinkOptions>({
  name: 'link',
  inclusive() {
    return this.options.autolink
  },
  keepOnSplit: false,

  onCreate() {
    this.options.protocols.forEach(registerCustomProtocol)
  },

  addOptions() {
    return {
      autolink: true,
      protocols: [],
      openOnClick: true,
      linkOnPaste: true,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: null,
      },
      validate: undefined,
      onModKPressed: undefined,
    }
  },

  addAttributes() {
    return {
      href: {
        default: null,
      },
      target: {
        default: this.options.HTMLAttributes.target,
      },
      class: {
        default: this.options.HTMLAttributes.class,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[href]:not([href *= "javascript:" i])' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setLink:
        (attributes) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, attributes)
            .setMeta('preventAutolink', true)
            .run()
        },
      toggleLink:
        (attributes) =>
        ({ chain }) => {
          return chain()
            .toggleMark(this.name, attributes, { extendEmptyMarkRange: true })
            .setMeta('preventAutolink', true)
            .run()
        },
      unsetLink:
        () =>
        ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .setMeta('preventAutolink', true)
            .run()
        },
    }
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: (text) =>
          find(text)
            .filter((link) => {
              if (this.options.validate) {
                return this.options.validate(link.value)
              }
              return true
            })
            .filter((link) => link.isLink)
            .map((link) => ({
              text: link.value,
              index: link.start,
              data: link,
            })),
        type: this.type,
        getAttributes: (match) => ({
          href: match.data?.href,
        }),
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.options.onModKPressed?.()
        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const plugins = []

    if (this.options.autolink) {
      plugins.push(
        autolink({
          type: this.type,
          validate: this.options.validate,
        }),
      )
    }

    if (this.options.openOnClick) {
      plugins.push(
        clickHandler({
          type: this.type,
        }),
      )
    }

    if (this.options.linkOnPaste) {
      plugins.push(
        pasteHandler({
          editor: this.editor,
          type: this.type,
        }),
      )
    }

    return plugins
  },
})

