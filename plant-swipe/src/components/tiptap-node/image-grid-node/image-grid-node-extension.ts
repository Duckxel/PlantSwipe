import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageGridNode as ImageGridNodeComponent } from "./image-grid-node"

export type GridColumns = 2 | 3 | 4
export type GridGap = "none" | "sm" | "md" | "lg"

export interface ImageGridNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface ImageGridImage {
  src: string
  alt?: string
  width?: string
}

export interface ImageGridAttributes {
  images: ImageGridImage[]
  columns: GridColumns
  gap: GridGap
  rounded: boolean
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    imageGrid: {
      setImageGrid: (options?: Partial<ImageGridAttributes>) => ReturnType
    }
  }
}

export const ImageGridNode = Node.create<ImageGridNodeOptions>({
  name: "imageGrid",

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
      images: {
        default: [] as ImageGridImage[],
        parseHTML: (element: HTMLElement) => {
          try {
            return JSON.parse(element.getAttribute("data-images") || "[]")
          } catch {
            return []
          }
        },
        renderHTML: (attributes) => ({
          "data-images": JSON.stringify(attributes.images),
        }),
      },
      columns: {
        default: 2 as GridColumns,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute("data-columns")
          return val ? (parseInt(val, 10) as GridColumns) : 2
        },
      },
      gap: {
        default: "md" as GridGap,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-gap") as GridGap) || "md"
        },
      },
      rounded: {
        default: true,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute("data-rounded")
          return val !== "false"
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-grid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { images, columns, gap, rounded } = HTMLAttributes as ImageGridAttributes
    
    const gapMap: Record<GridGap, string> = {
      none: "0",
      sm: "8px",
      md: "16px",
      lg: "24px",
    }

    const gridStyle = `
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: ${gapMap[gap]};
      padding: 16px 0;
    `.replace(/\s+/g, " ").trim()

    const imageElements = (images || []).map((img: ImageGridImage) => [
      "img",
      {
        src: img.src,
        alt: img.alt || "",
        style: `width: 100%; height: auto; object-fit: cover; ${rounded ? "border-radius: 16px;" : ""}`,
      },
    ])

    return [
      "div",
      mergeAttributes(
        { 
          "data-type": "image-grid",
          "data-columns": String(columns),
          "data-gap": gap,
          "data-rounded": String(rounded),
          style: gridStyle,
        },
        this.options.HTMLAttributes,
        { "data-images": JSON.stringify(images) }
      ),
      ...imageElements,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGridNodeComponent)
  },

  addCommands() {
    return {
      setImageGrid:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              images: options?.images ?? [],
              columns: options?.columns ?? 2,
              gap: options?.gap ?? "md",
              rounded: options?.rounded ?? true,
            },
          })
        },
    }
  },
})

export default ImageGridNode
