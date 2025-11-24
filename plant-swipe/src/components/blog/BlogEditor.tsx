import React, { forwardRef, useEffect, useImperativeHandle } from 'react'
import grapesjs, { type Editor } from 'grapesjs'
import gjsPresetWebpage from 'grapesjs-preset-webpage'
import 'grapesjs/dist/css/grapes.min.css'

export type BlogEditorHandle = {
  getHtml: () => string
  getCss: () => string
  getProjectData: () => Record<string, unknown> | null
  loadProject: (data: Record<string, unknown>) => void
}

type BlogEditorProps = {
  initialHtml?: string | null
  initialProject?: Record<string, unknown> | null
  height?: string | number
  className?: string
}

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(
  ({ initialHtml, initialProject, height = '65vh', className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null)
    const editorRef = React.useRef<Editor | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editorRef.current?.getHtml() ?? '',
        getCss: () => editorRef.current?.getCss() ?? '',
        getProjectData: () => (editorRef.current?.getProjectData() ?? null) as Record<string, unknown> | null,
        loadProject: (data: Record<string, unknown>) => {
          if (editorRef.current) {
            editorRef.current.loadProjectData(data)
          }
        },
      }),
      [],
    )

    useEffect(() => {
      if (!containerRef.current || editorRef.current) {
        return
      }
      const editorHeight = typeof height === 'number' ? `${height}px` : height
      const instance = grapesjs.init({
        container: containerRef.current,
        height: editorHeight,
        width: '100%',
        storageManager: false,
        selectorManager: { componentFirst: true },
        plugins: [gjsPresetWebpage],
        pluginsOpts: {
          'gjs-preset-webpage': {
            blocksBasic: true,
            customStyleManager: true,
            navbarOpts: false,
          },
        },
      })

      editorRef.current = instance

      if (initialProject) {
        instance.loadProjectData(initialProject)
      } else if (initialHtml) {
        instance.setComponents(initialHtml)
      }

      return () => {
        editorRef.current?.destroy()
        editorRef.current = null
      }
    }, [height, initialHtml, initialProject])

    useEffect(() => {
      if (!editorRef.current) return
      if (initialProject) {
        editorRef.current.loadProjectData(initialProject)
      } else if (initialHtml) {
        editorRef.current.setComponents(initialHtml)
      }
    }, [initialHtml, initialProject])

    return <div ref={containerRef} className={className} />
  },
)

BlogEditor.displayName = 'BlogEditor'
