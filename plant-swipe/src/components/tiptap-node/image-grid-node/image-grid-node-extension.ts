import { mergeAttributes, Node } from "@tiptap/react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageGridNode as ImageGridNodeComponent } from "./image-grid-node"

export type GridColumns = 2 | 3 | 4
export type GridGap = "none" | "sm" | "md" | "lg"
export type GridAspectRatio = "square" | "landscape" | "portrait"

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
  /** Focal point X position (0-100, default 50 = center) */
  focalX?: number
  /** Focal point Y position (0-100, default 50 = center) */
  focalY?: number
}

export type ImageGridAlign = "left" | "center" | "right"

export interface ImageGridAttributes {
  images: ImageGridImage[]
  columns: GridColumns
  gap: GridGap
  rounded: boolean
  width: string
  align: ImageGridAlign
  aspectRatio: GridAspectRatio
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
      // Try to extract focal point from data attributes first
      const dataFocalX = img.getAttribute('data-focal-x')
      const dataFocalY = img.getAttribute('data-focal-y')
      
      // Fallback to object-position style
      const style = img.getAttribute('style') || ''
      const objectPosMatch = style.match(/object-position:\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/)
      
      // Use data attributes if available, otherwise use object-position, default to 50
      const focalX = dataFocalX ? parseFloat(dataFocalX) : (objectPosMatch ? parseFloat(objectPosMatch[1]) : 50)
      const focalY = dataFocalY ? parseFloat(dataFocalY) : (objectPosMatch ? parseFloat(objectPosMatch[2]) : 50)
      
      images.push({
        src,
        alt: img.getAttribute('alt') || '',
        width: img.getAttribute('width') || undefined,
        focalX,
        focalY,
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
      aspectRatio: {
        default: "square" as GridAspectRatio,
        parseHTML: (element: HTMLElement) => {
          return (element.getAttribute("data-aspect-ratio") as GridAspectRatio) || "square"
        },
        renderHTML: (attributes) => ({
          "data-aspect-ratio": attributes.aspectRatio || "square",
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-grid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    // HTMLAttributes contains the merged HTML attributes from each attribute's renderHTML
    // The images are encoded in data-images, so we need to decode them
    const dataImages = HTMLAttributes["data-images"] as string | undefined
    const images = dataImages ? decodeImagesAttr(dataImages) : []
    
    // Get other attributes (these are passed as data-* attributes too)
    const columns = parseInt(HTMLAttributes["data-columns"] as string, 10) || 2
    const gap = (HTMLAttributes["data-gap"] as GridGap) || "md"
    const rounded = HTMLAttributes["data-rounded"] !== "false"
    const width = (HTMLAttributes["data-width"] as string) || "100%"
    const align = (HTMLAttributes["data-align"] as ImageGridAlign) || "center"
    const aspectRatio = (HTMLAttributes["data-aspect-ratio"] as GridAspectRatio) || "square"
    
    const gapMap: Record<GridGap, string> = {
      none: "0",
      sm: "8px",
      md: "16px",
      lg: "24px",
    }

    // Aspect ratio CSS values
    const aspectRatioMap: Record<GridAspectRatio, string> = {
      square: "1/1",
      landscape: "16/10",
      portrait: "10/16",
    }

    const widthValue = width || "100%"
    const alignValue = align || "center"
    const aspectRatioValue = aspectRatioMap[aspectRatio] || "1/1"
    
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

    const imageElements = (images || []).map((img: ImageGridImage) => {
      const focalX = img.focalX ?? 50
      const focalY = img.focalY ?? 50
      return [
        "img",
        {
          src: img.src,
          alt: img.alt || "",
          style: `width: 100%; height: auto; object-fit: cover; object-position: ${focalX}% ${focalY}%; aspect-ratio: ${aspectRatioValue}; ${rounded ? "border-radius: 16px;" : ""}`,
          "data-grid-image": "true",
          "data-focal-x": String(focalX),
          "data-focal-y": String(focalY),
        },
      ]
    })

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
 * Finds the matching closing div tag for a div starting at the given position
 * Handles nested divs correctly by counting depth
 */
function findMatchingDivClose(html: string, startPos: number): number {
  let depth = 0
  let pos = startPos
  
  while (pos < html.length) {
    const openMatch = html.slice(pos).match(/^<div\b/i)
    const closeMatch = html.slice(pos).match(/^<\/div>/i)
    
    if (openMatch) {
      depth++
      pos += openMatch[0].length
    } else if (closeMatch) {
      depth--
      if (depth === 0) {
        return pos + closeMatch[0].length
      }
      pos += closeMatch[0].length
    } else {
      pos++
    }
  }
  
  return -1 // Not found
}

/**
 * Converts an image grid HTML to email-compatible table-based HTML
 * Call this function when preparing HTML for email sending
 */
export function convertImageGridToEmailHtml(html: string): string {
  let result = html
  let searchPos = 0
  
  // Find all image-grid divs and replace them
  while (true) {
    const openingTagMatch = result.slice(searchPos).match(/<div[^>]*data-type="image-grid"[^>]*>/i)
    if (!openingTagMatch || openingTagMatch.index === undefined) break
    
    const startPos = searchPos + openingTagMatch.index
    const endPos = findMatchingDivClose(result, startPos)
    
    if (endPos === -1) {
      // Couldn't find matching close, skip this one
      searchPos = startPos + openingTagMatch[0].length
      continue
    }
    
    // Extract the full match
    const match = result.slice(startPos, endPos)
    
    // Extract attributes from the opening tag
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
    
    if (!images.length) {
      // No images found, skip this one
      searchPos = endPos
      continue
    }
    
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
      const cells = rowImages.map(img => {
        const focalX = img.focalX ?? 50
        const focalY = img.focalY ?? 50
        // Use a background-image div for email clients that don't support object-position
        // This provides a cropped view with focal point support
        // height: 0 is essential for the padding-bottom aspect ratio trick
        // position: relative and display: block ensure proper rendering
        return `
        <td style="width: ${cellWidth}%; padding: ${gapPx / 2}px; vertical-align: top;">
          <div style="display: block; position: relative; width: 100%; height: 0; padding-bottom: 62.5%; background-image: url('${img.src}'); background-size: cover; background-position: ${focalX}% ${focalY}%; background-repeat: no-repeat; ${isRounded ? 'border-radius: 16px;' : ''}" role="img" aria-label="${img.alt || ''}"></div>
        </td>
      `}).join('')
      
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
    
    const replacement = `
      <table role="presentation" data-type="image-grid" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td align="${alignAttr}" style="padding: 0;">
            ${innerTable}
          </td>
        </tr>
      </table>
    `.replace(/\s+/g, ' ').trim()
    
    // Replace the match with the table
    result = result.slice(0, startPos) + replacement + result.slice(endPos)
    
    // Continue searching after the replacement
    searchPos = startPos + replacement.length
  }
  
  return result
}

export default ImageGridNode
