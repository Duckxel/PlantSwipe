import { Plus, GripVertical } from 'lucide-react'
import { NodeViewWrapper, NodeViewProps, NodeViewContent } from '@tiptap/react'
import { cn } from '@/lib/utils'

export const DBlockNodeView = ({ node, getPos, editor }: NodeViewProps) => {
  const isTable =
    (node.content as any)?.content?.[0]?.type?.name === 'table'

  const insertBlockAfter = () => {
    const pos = getPos() + node.nodeSize
    editor
      .chain()
      .insertContentAt(pos, {
        type: 'dBlock',
        content: [{ type: 'paragraph' }],
      })
      .focus(pos + 2)
      .run()
  }

  return (
    <NodeViewWrapper className="group relative flex w-full gap-2">
      <div className="flex flex-col items-center gap-1 pt-1" contentEditable={false}>
        <button
          type="button"
          className="d-block-button group-hover:opacity-100"
          onClick={insertBlockAfter}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="d-block-button group-hover:opacity-100 cursor-grab"
          data-drag-handle
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <NodeViewContent
        className={cn('node-view-content flex-1', {
          'ml-6': isTable,
        })}
      />
    </NodeViewWrapper>
  )
}

