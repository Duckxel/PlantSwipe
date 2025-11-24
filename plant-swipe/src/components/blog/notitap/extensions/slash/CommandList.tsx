import React, { useEffect, useImperativeHandle, useState } from 'react'
import { stopPrevent } from '../../utils/dom'
import type { SlashCommandItem } from './types'

type CommandListProps = {
  items: Array<SlashCommandItem & { highlightedTitle?: string }>
  command: (item: SlashCommandItem) => void
}

export const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          stopPrevent(event)
          setSelectedIndex((index) => (index + items.length - 1) % items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          stopPrevent(event)
          setSelectedIndex((index) => (index + 1) % items.length)
          return true
        }

        if (event.key === 'Enter') {
          stopPrevent(event)
          selectItem(selectedIndex)
          return true
        }

        return false
      },
    }))

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) {
        command(item)
      }
    }

    if (!items.length) {
      return (
        <div className="px-4 py-3 text-sm text-stone-500">No results</div>
      )
    }

    return (
      <div className="max-h-80 w-80 overflow-y-auto p-1">
        {items.map((item, index) => {
          const Icon = item.icon
          const isSelected = index === selectedIndex
          return (
            <button
              type="button"
              key={item.id}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                isSelected ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : ''
              }`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.highlightedTitle ? (
                    <span dangerouslySetInnerHTML={{ __html: item.highlightedTitle }} />
                  ) : (
                    item.title
                  )}
                </span>
                <span className="ml-10 block text-xs text-stone-500 dark:text-stone-400">
                  {item.description}
                </span>
              </span>
              {item.shortcut && (
                <code className="rounded border border-stone-200 px-1 py-0.5 text-xs text-stone-500 dark:border-stone-700">
                  {item.shortcut}
                </code>
              )}
            </button>
          )
        })}
      </div>
    )
  },
)

CommandList.displayName = 'CommandList'

