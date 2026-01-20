import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import CharacterCount from "@tiptap/extension-character-count"
import Typography from "@tiptap/extension-typography"
import TextAlign from "@tiptap/extension-text-align"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Highlight from "@tiptap/extension-highlight"
import Superscript from "@tiptap/extension-superscript"
import Subscript from "@tiptap/extension-subscript"
import { Selection } from "@tiptap/extensions"
import Image from "@tiptap/extension-image"
import GapCursor from "@tiptap/extension-gapcursor"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import type { Extension, JSONContent } from "@tiptap/core"

import { cn } from "@/lib/utils"
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { EmailButtonNode } from "@/components/tiptap-node/email-button-node/email-button-node-extension"
import { StyledDividerNode } from "@/components/tiptap-node/styled-divider-node/styled-divider-node-extension"
import { ImageGridNode } from "@/components/tiptap-node/image-grid-node/image-grid-node-extension"
import { ResizableImageNode } from "@/components/tiptap-node/resizable-image-node/resizable-image-node-extension"
import { EmailCardNode } from "@/components/tiptap-node/email-card-node/email-card-node-extension"
import { SensitiveCodeNode } from "@/components/tiptap-node/sensitive-code-node/sensitive-code-node-extension"

import { Toolbar, ToolbarGroup, ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverButton,
  ColorHighlightPopoverContent,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  TextColorPopover,
  TextColorPopoverButton,
  TextColorPopoverContent,
} from "@/components/tiptap-ui/text-color-popover"
import { LinkPopover, LinkButton, LinkContent } from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { EmailButtonButton } from "@/components/tiptap-ui/email-button-button"
import { DividerDropdownMenu } from "@/components/tiptap-ui/divider-dropdown-menu"
import { ImageGridButton } from "@/components/tiptap-ui/image-grid-button"
import { EmailCardButton } from "@/components/tiptap-ui/email-card-button"
import { SensitiveCodeButton } from "@/components/tiptap-ui/sensitive-code-button"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { TypeIcon } from "@/components/tiptap-icons/type-icon"

import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/components/tiptap-templates/simple/simple-editor.scss"

export type BlogEditorHandle = {
  getHtml: () => string
  getDocument: () => JSONContent | null
  setContent: (input: { html?: string; doc?: JSONContent }) => void
}

type BlogEditorProps = {
  initialHtml?: string | null
  initialDocument?: JSONContent | null
  className?: string
  editorContentClassName?: string
  uploadFolder: string
  onUpdate?: (payload: { html: string; doc: JSONContent | null; plainText: string }) => void
  extraExtensions?: Extension[]
  toolbarAppend?: ReactNode
  /** Use 'embedded' variant when editor is inside another container with borders */
  variant?: "default" | "embedded"
}

const DEFAULT_CONTENT =
  '<h2>New Aphylia story</h2><p>Use the toolbar to add headings, embeds, dividers, or quotes.</p>'

const MainToolbarContent: React.FC<{
  onHighlighterClick: () => void
  onLinkClick: () => void
  onTextColorClick: () => void
  isMobile: boolean
}> = ({ onHighlighterClick, onLinkClick, onTextColorClick, isMobile }) => (
  <>
    <Spacer />

    <ToolbarGroup>
      <UndoRedoButton action="undo" />
      <UndoRedoButton action="redo" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal />
      <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} portal />
      <BlockquoteButton />
      <CodeBlockButton />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="bold" />
      <MarkButton type="italic" />
      <MarkButton type="strike" />
      <MarkButton type="code" />
      <MarkButton type="underline" />
      {!isMobile ? (
        <TextColorPopover />
      ) : (
        <TextColorPopoverButton onClick={onTextColorClick} />
      )}
      {!isMobile ? (
        <ColorHighlightPopover />
      ) : (
        <ColorHighlightPopoverButton onClick={onHighlighterClick} />
      )}
      {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="superscript" />
      <MarkButton type="subscript" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <TextAlignButton align="left" />
      <TextAlignButton align="center" />
      <TextAlignButton align="right" />
      <TextAlignButton align="justify" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <ImageUploadButton text="Image" />
      <ImageGridButton />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <EmailButtonButton />
      <EmailCardButton />
      <SensitiveCodeButton />
      <DividerDropdownMenu portal />
    </ToolbarGroup>

  </>
)

const MobileToolbarContent: React.FC<{
  type: "highlighter" | "link" | "textcolor"
  onBack: () => void
}> = ({ type, onBack }) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : type === "textcolor" ? (
          <TypeIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : type === "textcolor" ? (
      <TextColorPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(
  ({ initialHtml, initialDocument, className, editorContentClassName, uploadFolder, onUpdate, extraExtensions, toolbarAppend, variant = "default" }, ref) => {
    const isMobile = useIsBreakpoint()
    const { height } = useWindowSize()
    const toolbarRef = useRef<HTMLDivElement>(null)
    const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link" | "textcolor">("main")
    const [wordCount, setWordCount] = useState(0)
    const uploadFolderRef = useRef(uploadFolder)
    uploadFolderRef.current = uploadFolder

    const uploadHandler = useCallback(
      (file: File, onProgress?: (event: { progress: number }) => void, signal?: AbortSignal) =>
        handleImageUpload(file, onProgress, signal, { folder: uploadFolderRef.current }),
      [],
    )

    const editor = useEditor({
      immediatelyRender: false,
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
          class: cn("simple-editor", editorContentClassName),
        },
      },
      extensions: [
        StarterKit.configure({
          horizontalRule: false,
          heading: { levels: [1, 2, 3, 4] },
          dropcursor: { color: "#34d399", width: 2 },
          // We define these extensions manually with custom config below
          link: false,
          underline: false,
          gapcursor: false,
        }),
        Placeholder.configure({
          placeholder: 'Type "/" for quick commands or start writing…',
        }),
        Link.configure({
          openOnClick: false,
          defaultProtocol: "https",
        }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        CharacterCount.configure({ limit: 30000 }),
        Typography,
        Superscript,
        Subscript,
        Selection,
        Image,
        GapCursor,
        HorizontalRule,
        ImageUploadNode.configure({
          type: "resizableImage", // Use resizable image node for alignment & sizing controls
          accept: "image/*",
          limit: 3,
          maxSize: MAX_FILE_SIZE,
          upload: uploadHandler,
          onError: (error) => console.error("[BlogEditor] upload failed", error),
          HTMLAttributes: { class: "rounded-3xl overflow-hidden" },
        }),
        EmailButtonNode,
        StyledDividerNode,
        ImageGridNode.configure({
          uploadFolder: uploadFolderRef.current,
        }),
        ResizableImageNode,
        EmailCardNode,
        SensitiveCodeNode,
        ...(extraExtensions || []),
      ],
      content: initialDocument ?? initialHtml ?? DEFAULT_CONTENT,
      onUpdate: ({ editor: editorInstance }) => {
        onUpdate?.({
          html: editorInstance.getHTML(),
          doc: editorInstance.getJSON(),
          plainText: editorInstance.getText(),
        })
        setWordCount(editorInstance.storage?.characterCount?.words?.() ?? 0)
      },
    })

    useEffect(() => {
      if (!editor) return
      if (initialDocument) {
        editor.commands.setContent(initialDocument)
        return
      }
      if (initialHtml) {
        editor.commands.setContent(initialHtml, { emitUpdate: false })
      }
    }, [editor, initialDocument, initialHtml])

    const rect = useCursorVisibility({
      editor,
      overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
    })

    useEffect(() => {
      if (!isMobile && mobileView !== "main") {
        setMobileView("main")
      }
    }, [isMobile, mobileView])

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editor?.getHTML() ?? "",
        getDocument: () => editor?.getJSON() ?? null,
        setContent: ({ html, doc }) => {
          if (!editor) return
          if (doc) {
            editor.commands.setContent(doc)
          } else if (html) {
            editor.commands.setContent(html, { emitUpdate: false })
          }
        },
      }),
      [editor],
    )

    useEffect(() => {
      if (!editor) return
      setWordCount(editor.storage?.characterCount?.words?.() ?? 0)
    }, [editor])

    const isEmbedded = variant === "embedded"

    return (
      <div
        className={cn(
          "relative",
          !isEmbedded && "rounded-3xl border border-stone-200/80 bg-white/90 p-0 shadow-sm dark:border-[#3e3e42] dark:bg-[#0f0f11]",
          className,
        )}
      >
        <EditorContext.Provider value={{ editor }}>
          <Toolbar
            ref={toolbarRef}
            className={cn(
              "sticky top-0 z-20 bg-white/95 backdrop-blur-sm dark:bg-[#0f0f11]/95",
              !isEmbedded && "rounded-t-3xl"
            )}
            style={
              isMobile
                ? ({
                  bottom: `calc(100% - ${height - rect.y}px)`,
                } as React.CSSProperties)
                : undefined
            }
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                onTextColorClick={() => setMobileView("textcolor")}
                isMobile={isMobile}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView}
                onBack={() => setMobileView("main")}
              />
            )}
            {toolbarAppend ? (
              <div className="ml-auto flex items-center gap-2">{toolbarAppend}</div>
            ) : null}
          </Toolbar>

          <EditorContent editor={editor} role="presentation" className="simple-editor-content" />
        </EditorContext.Provider>

        {!isEmbedded && (
          <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 text-xs text-stone-500 dark:border-[#3e3e42] dark:text-stone-400">
            <span>Use "/" for quick commands · Drag blocks to rearrange</span>
            <span>{wordCount} words</span>
          </div>
        )}
      </div>
    )
  },
)

BlogEditor.displayName = "BlogEditor"
