import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageGridNode as ImageGridNodeComponent } from "./image-grid-node"

export type GridColumns = 2 | 3 | 4
export type GridGap = "none" | "sm" | "md" | "lg"

export interface ImageGridNodeOptions {
  HTMLAttributes: Record<string, unknown>
  /**
   * The folder to upload images to.
   * @default 'image-grids'
   */
  uploadFolder?: string
}

export interface ImageGridImage {
  src: string
  alt?: string
  width?: string
}

export type ImageGridAlign = "left" | "center" | "right"

export interface ImageGridAttributes {
  images: ImageGridImage[]
  columns: GridColumns
  gap: GridGap
  rounded: boolean
  width: string
  align: ImageGridAlign
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
      uploadFolder: 'image-grids',
    }
  },

  addStorage() {
    return {
      uploadFolder: this.options.uploadFolder || 'image-grids',
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
      width: {
        default: "100%",
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute("data-width") || "100%"
        },
        renderHTML: (attributes) => ({
          "data-width": attributes.width || "100%",
        }),
      },
      align: {
        default: "center" as ImageGridAlign,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-align") as ImageGridAlign) || "center"
        },
        renderHTML: (attributes) => ({
          "data-align": attributes.align || "center",
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-grid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { images, columns, gap, rounded, width, align } = HTMLAttributes as ImageGridAttributes
    
    const gapMap: Record<GridGap, string> = {
      none: "0",
      sm: "8px",
      md: "16px",
      lg: "24px",
    }

    const widthValue = width || "100%"
    const alignValue = align || "center"
    
    // Container style for alignment
    const containerStyle = `
      text-align: ${alignValue};
      padding: 16px 0;
    `.replace(/\s+/g, " ").trim()

    // Grid style
    const gridStyle = `
      display: inline-grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: ${gapMap[gap]};
      width: ${widthValue};
      max-width: 100%;
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
          "data-width": widthValue,
          "data-align": alignValue,
          "data-images": encodeImagesAttr(images),
          style: containerStyle,
        },
        this.options.HTMLAttributes
      ),
      [
        "div",
        { style: gridStyle },
        ...imageElements,
      ],
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
              width: options?.width ?? "100%",
              align: options?.align ?? "center",
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
  // Match image-grid divs - handle nested structure with inner grid div
  const regex = /<div[^>]*data-type="image-grid"[^>]*>[\s\S]*?(?:<\/div>\s*<\/div>|<\/div>)/gi
  
  return html.replace(regex, (match) => {
    // Extract attributes from the match
    const columnsMatch = match.match(/data-columns="(\d)"/)
    const gapMatch = match.match(/data-gap="([^"]*)"/)
    const roundedMatch = match.match(/data-rounded="([^"]*)"/)
    const imagesMatch = match.match(/data-images="([^"]*)"/)
    const widthMatch = match.match(/data-width="([^"]*)"/)
    const alignMatch = match.match(/data-align="([^"]*)"/)
    
    const numCols = columnsMatch ? parseInt(columnsMatch[1], 10) : 2
    const gap = gapMatch ? gapMatch[1] : 'md'
    const isRounded = !roundedMatch || roundedMatch[1] !== "false"
    const gridWidth = widthMatch ? widthMatch[1] : '100%'
    const align = alignMatch ? alignMatch[1] : 'center'
    
    // Try to get images from data-images attribute
    const images = imagesMatch ? decodeImagesAttr(imagesMatch[1]) : []
    if (!images.length) return match
    
    const gapMap: Record<string, number> = {
      none: 0,
      sm: 8,
      md: 16,
      lg: 24,
    }
    const gapPx = gapMap[gap] || 16
    const cellWidth = Math.floor(100 / numCols)
    
    // Determine alignment for the outer table
    const alignAttr = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
    
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
    
    // Wrap in outer alignment table
    const innerTable = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: ${gridWidth}; max-width: 100%; border-collapse: collapse;">
        ${rows.join('')}
      </table>
    `
    
    return `
      <table role="presentation" data-type="image-grid" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td align="${alignAttr}" style="padding: 0;">
            ${innerTable}
          </td>
        </tr>
      </table>
    `.replace(/\s+/g, ' ').trim()
  })
}

export default ImageGridNode
