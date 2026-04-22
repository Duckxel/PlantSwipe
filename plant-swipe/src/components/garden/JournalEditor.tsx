import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
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
import GapCursor from "@tiptap/extension-gapcursor"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"

import { cn } from "@/lib/utils"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"

import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
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
import {
  LinkPopover,
  LinkButton,
  LinkContent,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { TypeIcon } from "@/components/tiptap-icons/type-icon"

import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/components/tiptap-templates/simple/simple-editor.scss"

export type JournalEditorHandle = {
  getHtml: () => string
  getPlainText: () => string
  setContent: (input: { html?: string | null }) => void
  clear: () => void
}

type JournalEditorProps = {
  initialHtml?: string | null
  /** Plain-text fallback if no HTML is available (legacy entries) */
  initialPlainText?: string | null
  placeholder?: string
  className?: string
  editorContentClassName?: string
  characterLimit?: number
  onUpdate?: (payload: { html: string; plainText: string }) => void
}

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
      <HeadingDropdownMenu levels={[1, 2, 3]} portal />
      <ListDropdownMenu
        types={["bulletList", "orderedList", "taskList"]}
        portal
      />
      <BlockquoteButton />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="bold" />
      <MarkButton type="italic" />
      <MarkButton type="strike" />
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
      <TextAlignButton align="left" />
      <TextAlignButton align="center" />
      <TextAlignButton align="right" />
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

function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

export const JournalEditor = forwardRef<JournalEditorHandle, JournalEditorProps>(
  (
    {
      initialHtml,
      initialPlainText,
      placeholder,
      className,
      editorContentClassName,
      characterLimit = 15000,
      onUpdate,
    },
    ref,
  ) => {
    const isMobile = useIsBreakpoint()
    const { height } = useWindowSize()
    const toolbarRef = useRef<HTMLDivElement>(null)
    const [mobileView, setMobileView] = useState<
      "main" | "highlighter" | "link" | "textcolor"
    >("main")

    const initialContent =
      initialHtml && initialHtml.trim().length > 0
        ? initialHtml
        : initialPlainText && initialPlainText.trim().length > 0
          ? plainTextToHtml(initialPlainText)
          : ""

    const editor = useEditor({
      immediatelyRender: false,
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "on",
          autocapitalize: "sentences",
          "aria-label":
            placeholder ||
            "Journal entry content. Start typing to record your observations.",
          class: cn("simple-editor", editorContentClassName),
        },
      },
      extensions: [
        StarterKit.configure({
          horizontalRule: false,
          heading: { levels: [1, 2, 3] },
          dropcursor: { color: "#10b981", width: 2 },
          link: false,
          underline: false,
          gapcursor: false,
          codeBlock: false,
        }),
        Placeholder.configure({
          placeholder:
            placeholder ||
            "What did you notice today? How are your plants doing?",
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
        CharacterCount.configure({ limit: characterLimit }),
        Typography,
        Superscript,
        Subscript,
        Selection,
        GapCursor,
        HorizontalRule,
      ],
      content: initialContent,
      onUpdate: ({ editor: editorInstance }) => {
        onUpdate?.({
          html: editorInstance.getHTML(),
          plainText: editorInstance.getText(),
        })
      },
    })

    useEffect(() => {
      if (!editor) return
      if (!isMobile && mobileView !== "main") setMobileView("main")
    }, [editor, isMobile, mobileView])

    const rect = useCursorVisibility({
      editor,
      overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
    })

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editor?.getHTML() ?? "",
        getPlainText: () => editor?.getText() ?? "",
        setContent: ({ html }) => {
          if (!editor) return
          editor.commands.setContent(html && html.trim().length > 0 ? html : "", {
            emitUpdate: false,
          })
        },
        clear: () => {
          editor?.commands.clearContent(true)
        },
      }),
      [editor],
    )

    return (
      <div
        className={cn(
          "relative rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900",
          className,
        )}
      >
        <EditorContext.Provider value={{ editor }}>
          <Toolbar
            ref={toolbarRef}
            className="sticky top-0 z-10 rounded-t-xl border-b border-stone-200 bg-white/95 backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95"
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
          </Toolbar>

          <EditorContent
            editor={editor}
            role="presentation"
            className="simple-editor-content"
          />
        </EditorContext.Provider>
      </div>
    )
  },
)

JournalEditor.displayName = "JournalEditor"
