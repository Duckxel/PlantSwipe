import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  getMarksBetween,
} from '@tiptap/core'
import { find, test } from 'linkifyjs'
import type { MarkType } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'

type AutolinkOptions = {
  type: MarkType
  validate?: (url: string) => boolean
}

export function autolink(options: AutolinkOptions): Plugin {
  return new Plugin({
    key: new PluginKey('autolink'),
    appendTransaction: (transactions, oldState, newState) => {
      const docChanges =
        transactions.some((transaction) => transaction.docChanged) &&
        !oldState.doc.eq(newState.doc)
      const preventAutolink = transactions.some((transaction) =>
        transaction.getMeta('preventAutolink'),
      )

      if (!docChanges || preventAutolink) {
        return null
      }

      const transform = combineTransactionSteps(oldState.doc, transactions)
      const { mapping } = transform
      const changes = getChangedRanges(transform)
      const tr = newState.tr

      changes.forEach(({ oldRange, newRange }) => {
        getMarksBetween(oldRange.from, oldRange.to, oldState.doc)
          .filter((item) => item.mark.type === options.type)
          .forEach((oldMark) => {
            const newFrom = mapping.map(oldMark.from)
            const newTo = mapping.map(oldMark.to)
            const newMarks = getMarksBetween(newFrom, newTo, newState.doc).filter(
              (item) => item.mark.type === options.type,
            )

            if (!newMarks.length) {
              return
            }

            const newMark = newMarks[0]
            const oldText = oldState.doc.textBetween(oldMark.from, oldMark.to, undefined, ' ')
            const newText = newState.doc.textBetween(newMark.from, newMark.to, undefined, ' ')
            const wasLink = test(oldText)
            const isLink = test(newText)

            if (wasLink && !isLink) {
              tr.removeMark(newMark.from, newMark.to, options.type)
            }
          })

        findChildrenInRange(newState.doc, newRange, (node) => node.isTextblock).forEach(
          (textBlock) => {
            const text = newState.doc.textBetween(
              textBlock.pos,
              textBlock.pos + textBlock.node.nodeSize,
              undefined,
              ' ',
            )

            find(text)
              .filter((link) => link.isLink)
              .filter((link) => {
                if (options.validate) {
                  return options.validate(link.value)
                }
                return true
              })
              .map((link) => ({
                ...link,
                from: textBlock.pos + link.start + 1,
                to: textBlock.pos + link.end + 1,
              }))
              .filter((link) => {
                const fromInRange = newRange.from >= link.from && newRange.from <= link.to
                const toInRange = newRange.to >= link.from && newRange.to <= link.to
                return fromInRange || toInRange
              })
              .forEach((link) => {
                tr.addMark(
                  link.from,
                  link.to,
                  options.type.create({
                    href: link.href,
                  }),
                )
              })
          },
        )
      })

      if (!tr.steps.length) {
        return null
      }

      return tr
    },
  })
}

