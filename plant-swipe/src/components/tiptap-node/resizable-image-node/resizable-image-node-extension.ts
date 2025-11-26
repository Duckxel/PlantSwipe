import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ResizableImageNode as ResizableImageNodeComponent } from "./resizable-image-node"

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
    
    const containerStyle = `
      text-align: ${align || "center"};
      padding: 16px 0;
    `.replace(/\s+/g, " ").trim()

    const imgStyle = `
      max-width: 100%;
      width: ${typeof width === "number" ? `${width}px` : width || "100%"};
      height: ${typeof height === "number" ? `${height}px` : height || "auto"};
      border-radius: 16px;
      display: inline-block;
    `.replace(/\s+/g, " ").trim()

    return [
      "div",
      mergeAttributes(
        { 
          "data-type": "resizable-image",
          "data-width": typeof width === "number" ? `${width}px` : width || "100%",
          "data-height": typeof height === "number" ? `${height}px` : height || "auto",
          "data-align": align || "center",
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
    return ReactNodeViewRenderer(ResizableImageNodeComponent)
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
