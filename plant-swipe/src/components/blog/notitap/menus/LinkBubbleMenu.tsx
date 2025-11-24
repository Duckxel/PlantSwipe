import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { test } from 'linkifyjs'
import classNames from 'classnames'

type LinkBubbleMenuProps = {
  editor: Editor
}

export const LinkBubbleMenu = ({ editor }: LinkBubbleMenuProps) => {
  const [href, setHref] = useState('')
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    setIsValid(!href || test(href))
  }, [href])

  useEffect(() => {
    const update = () => {
      if (editor.isActive('link')) {
        const linkHref = editor.getAttributes('link')?.href ?? ''
        setHref(linkHref)
      } else {
        setHref('')
      }
    }

    editor.on('selectionUpdate', update)
    return () => {
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  const updateLink = () => {
    if (!isValid || !href) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={() => editor.isActive('link')}
      className="rounded-2xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900"
      tippyOptions={{
        duration: 150,
        animation: 'shift-toward-subtle',
      }}
    >
      <input
        type="url"
        className={classNames(
          'w-72 rounded-xl border px-3 py-2 text-sm outline-none focus-visible:border-emerald-500 dark:bg-transparent',
          isValid ? 'border-stone-300 dark:border-stone-600' : 'border-red-500',
        )}
        value={href}
        placeholder="https://example.com"
        onChange={(event) => setHref(event.target.value.trim())}
        onBlur={updateLink}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            updateLink()
          }
        }}
      />
    </BubbleMenu>
  )
}

