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

/**
 * Helper to safely encode images array to a data attribute
 * Uses base64 encoding to avoid issues with JSON special characters in HTML attributes
 */
function encodeImagesAttr(images: ImageGridImage[]): string {
  try {
    const json = JSON.stringify(images || [])
    // Use base64 encoding to avoid HTML attribute escaping issues
    if (typeof btoa === 'function') {
      return btoa(encodeURIComponent(json))
    }
    // Fallback for environments without btoa
    return json
  } catch {
    return "[]"
  }
}

/**
 * Helper to safely decode images array from a data attribute
 */
function decodeImagesAttr(encoded: string | null): ImageGridImage[] {
  if (!encoded) return []
  
  try {
    // First try base64 decoding (new format)
    if (typeof atob === 'function') {
      try {
        const json = decodeURIComponent(atob(encoded))
        return JSON.parse(json)
      } catch {
        // If base64 fails, try direct JSON parse (old format compatibility)
      }
    }
    // Fallback: try direct JSON parse for backward compatibility
    return JSON.parse(encoded)
  } catch {
    return []
  }
}

/**
 * Extract images from child img elements (fallback for HTML parsing)
 */
function extractImagesFromChildren(element: HTMLElement): ImageGridImage[] {
  const images: ImageGridImage[] = []
  const imgElements = element.querySelectorAll('img')
  imgElements.forEach((img) => {
    const src = img.getAttribute('src')
    if (src) {
      images.push({
        src,
        alt: img.getAttribute('alt') || '',
        width: img.getAttribute('width') || undefined,
      })
    }
  })
  return images
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
          // First try the data-images attribute (base64 encoded or JSON)
          const dataImages = element.getAttribute("data-images")
          if (dataImages) {
            const decoded = decodeImagesAttr(dataImages)
            if (decoded.length > 0) {
              return decoded
            }
          }
          // Fallback: extract from child img elements
          return extractImagesFromChildren(element)
        },
        renderHTML: (attributes) => ({
          "data-images": encodeImagesAttr(attributes.images),
        }),
      },
      columns: {
        default: 2 as GridColumns,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute("data-columns")
          return val ? (parseInt(val, 10) as GridColumns) : 2
        },
        renderHTML: (attributes) => ({
          "data-columns": String(attributes.columns),
        }),
      },
      gap: {
        default: "md" as GridGap,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-gap") as GridGap) || "md"
        },
        renderHTML: (attributes) => ({
          "data-gap": attributes.gap,
        }),
      },
      rounded: {
        default: true,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute("data-rounded")
          return val !== "false"
        },
        renderHTML: (attributes) => ({
          "data-rounded": String(attributes.rounded),
        }),
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

    // Use table-based layout for better email compatibility
    // CSS Grid doesn't work well in email clients
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
        style: `width: 100%; height: auto; object-fit: cover; aspect-ratio: 16/10; ${rounded ? "border-radius: 16px;" : ""}`,
        "data-grid-image": "true",
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
          "data-images": encodeImagesAttr(images),
          style: gridStyle,
        },
        this.options.HTMLAttributes
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

/**
 * Converts an image grid HTML to email-compatible table-based HTML
 * Call this function when preparing HTML for email sending
 */
export function convertImageGridToEmailHtml(html: string): string {
  // Match image-grid divs and convert them to table-based layout
  const regex = /<div[^>]*data-type="image-grid"[^>]*data-columns="(\d)"[^>]*data-gap="([^"]*)"[^>]*data-rounded="([^"]*)"[^>]*data-images="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi
  
  return html.replace(regex, (match, columns, gap, rounded, imagesEncoded) => {
    const images = decodeImagesAttr(imagesEncoded)
    if (!images.length) return match
    
    const numCols = parseInt(columns, 10) || 2
    const isRounded = rounded !== "false"
    
    const gapMap: Record<string, number> = {
      none: 0,
      sm: 8,
      md: 16,
      lg: 24,
    }
    const gapPx = gapMap[gap] || 16
    const cellWidth = Math.floor(100 / numCols)
    
    // Build table rows
    const rows: string[] = []
    for (let i = 0; i < images.length; i += numCols) {
      const rowImages = images.slice(i, i + numCols)
      const cells = rowImages.map(img => `
        <td style="width: ${cellWidth}%; padding: ${gapPx / 2}px; vertical-align: top;">
          <img src="${img.src}" alt="${img.alt || ''}" style="width: 100%; height: auto; display: block; ${isRounded ? 'border-radius: 16px;' : ''}" />
        </td>
      `).join('')
      
      // Pad with empty cells if needed
      const emptyCells = numCols - rowImages.length
      const emptyHtml = emptyCells > 0 ? `<td style="width: ${cellWidth}%; padding: ${gapPx / 2}px;"></td>`.repeat(emptyCells) : ''
      
      rows.push(`<tr>${cells}${emptyHtml}</tr>`)
    }
    
    return `
      <table role="presentation" data-type="image-grid" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0; border-collapse: collapse;">
        ${rows.join('')}
      </table>
    `.replace(/\s+/g, ' ').trim()
  })
}

export default ImageGridNode
