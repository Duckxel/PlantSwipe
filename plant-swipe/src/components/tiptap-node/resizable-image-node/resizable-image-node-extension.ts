import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ResizableImageNode as ResizableImageNodeComponent } from "./resizable-image-node"
import { shouldStopNodeViewEvent } from "@/lib/tiptap-utils"

export type ImageAlign = "left" | "center" | "right"

export interface ResizableImageNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface ResizableImageAttributes {
  src: string
  alt?: string
  title?: string
  width?: number | string
  height?: number | string
  align?: ImageAlign
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: ResizableImageAttributes) => ReturnType
    }
  }
}

export const ResizableImageNode = Node.create<ResizableImageNodeOptions>({
  name: "resizableImage",

  group: "block",

  draggable: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img = element.querySelector("img")
          return img?.getAttribute("src") || null
        },
      },
      alt: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img = element.querySelector("img")
          return img?.getAttribute("alt") || null
        },
      },
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img = element.querySelector("img")
          return img?.getAttribute("title") || null
        },
      },
      width: {
        default: "100%",
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute("data-width") || "100%"
        },
      },
      height: {
        default: "auto",
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute("data-height") || "auto"
        },
      },
      align: {
        default: "center" as ImageAlign,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-align") as ImageAlign) || "center"
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="resizable-image"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, title, width, height, align } = HTMLAttributes as ResizableImageAttributes
    
    // Normalize width value
    const widthValue = typeof width === "number" ? `${width}px` : width || "100%"
    const heightValue = typeof height === "number" ? `${height}px` : height || "auto"
    const alignValue = align || "center"
    
    // Email-compatible container style using text-align for alignment
    const containerStyle = `
      text-align: ${alignValue};
      padding: 16px 0;
      margin: 0;
    `.replace(/\s+/g, " ").trim()

    // Email-compatible image style
    const imgStyle = `
      max-width: 100%;
      width: ${widthValue};
      height: ${heightValue};
      border-radius: 16px;
      display: inline-block;
      vertical-align: middle;
    `.replace(/\s+/g, " ").trim()

    return [
      "div",
      mergeAttributes(
        { 
          "data-type": "resizable-image",
          "data-width": widthValue,
          "data-height": heightValue,
          "data-align": alignValue,
          style: containerStyle,
        },
        this.options.HTMLAttributes
      ),
      [
        "img",
        {
          src,
          alt: alt || "",
          title: title || "",
          style: imgStyle,
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeComponent, {
      stopEvent: ({ event }) => shouldStopNodeViewEvent(event),
    })
  },

  addCommands() {
    return {
      setResizableImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt ?? "",
              title: options.title ?? "",
              width: options.width ?? "100%",
              height: options.height ?? "auto",
              align: options.align ?? "center",
            },
          })
        },
    }
  },
})

export default ResizableImageNode
