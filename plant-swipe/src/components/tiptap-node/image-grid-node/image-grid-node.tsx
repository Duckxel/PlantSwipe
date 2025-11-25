import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useState, useCallback, useRef } from "react"
import { Plus, Trash2, GripVertical, Image as ImageIcon } from "lucide-react"
import type { GridColumns, GridGap, ImageGridImage } from "./image-grid-node-extension"
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

const GAP_OPTIONS: { value: GridGap; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
]

export function ImageGridNode({ node, updateAttributes, selected }: NodeViewProps) {
  const { images, columns, gap, rounded } = node.attrs as {
    images: ImageGridImage[]
    columns: GridColumns
    gap: GridGap
    rounded: boolean
  }

  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const gapClasses: Record<GridGap, string> = {
    none: "gap-0",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  }

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setIsUploading(true)
      const newImages: ImageGridImage[] = [...images]

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Maximum size is 5MB.`)
          continue
        }

        try {
          const url = await handleImageUpload(file, undefined, undefined, { folder: "email-templates" })
          newImages.push({ src: url, alt: file.name })
        } catch (error) {
          console.error("Failed to upload image:", error)
          alert(`Failed to upload ${file.name}`)
        }
      }

      updateAttributes({ images: newImages })
      setIsUploading(false)
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [images, updateAttributes]
  )

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index)
      updateAttributes({ images: newImages })
    },
    [images, updateAttributes]
  )

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <NodeViewWrapper
      data-type="image-grid"
      className={`my-6 ${selected ? "ring-2 ring-emerald-500 ring-offset-4 rounded-2xl" : ""}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {images.length === 0 ? (
        // Empty state - prompt to add images
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 py-12 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-[#3e3e42] dark:bg-[#1a1a1d] dark:hover:border-emerald-600 dark:hover:bg-emerald-900/10"
          onClick={openFileDialog}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <ImageIcon className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="font-medium text-stone-700 dark:text-stone-200">
              {isUploading ? "Uploading..." : "Add Images to Grid"}
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Click to upload multiple images
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Image Grid */}
          <div
            className={`grid ${gapClasses[gap]}`}
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {images.map((img, index) => (
              <div
                key={`${img.src}-${index}`}
                className={`group relative overflow-hidden ${rounded ? "rounded-2xl" : ""}`}
              >
                <img
                  src={img.src}
                  alt={img.alt || ""}
                  className="h-auto w-full object-cover"
                  style={{ aspectRatio: "16/10" }}
                />
                {/* Overlay controls */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                    title="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-3">
              {/* Add more images */}
              <button
                type="button"
                onClick={openFileDialog}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isUploading ? "Uploading..." : "Add"}
              </button>

              {/* Columns */}
              <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 dark:border-[#3e3e42] dark:bg-[#0f0f11]">
                {([2, 3, 4] as GridColumns[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateAttributes({ columns: c })}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      columns === c
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Gap */}
              <select
                value={gap}
                onChange={(e) => updateAttributes({ gap: e.target.value as GridGap })}
                className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-[#3e3e42] dark:bg-[#0f0f11] dark:text-white"
              >
                {GAP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    Gap: {g.label}
                  </option>
                ))}
              </select>

              {/* Rounded */}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                <input
                  type="checkbox"
                  checked={rounded}
                  onChange={(e) => updateAttributes({ rounded: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                Rounded
              </label>
            </div>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default ImageGridNode
