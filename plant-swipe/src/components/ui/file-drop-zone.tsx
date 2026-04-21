/**
 * FileDropZone
 *
 * Shared drag-and-drop upload zone. Wraps children with drag/drop handlers
 * and an optional click-to-browse hidden file input. Consumers control the
 * visuals; the component only provides behavior + drag-active state.
 *
 * Behavior is built on top of {@link useFileDrop}. Drag-and-drop is
 * automatically disabled on native Capacitor (no drag affordance on mobile)
 * unless the caller overrides `dragEnabled`.
 *
 * Usage (children as a node — consumer styles via `dragActiveClassName` or
 * the `data-dragging` attribute):
 *
 *   <FileDropZone onFiles={handleFiles} accept={["image/"]} acceptInput="image/*">
 *     <DropZoneContent />
 *   </FileDropZone>
 *
 * Usage (render prop — read `isDragging` / call `openFilePicker`):
 *
 *   <FileDropZone onFiles={handleFiles}>
 *     {({ isDragging, openFilePicker }) => (
 *       <button onClick={openFilePicker}>{isDragging ? "Drop" : "Browse"}</button>
 *     )}
 *   </FileDropZone>
 *
 * Imperative access:
 *
 *   const ref = React.useRef<FileDropZoneHandle>(null)
 *   <FileDropZone ref={ref} clickToBrowse={false} onFiles={...}>...</FileDropZone>
 *   ref.current?.openFilePicker()
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { useFileDrop } from "@/hooks/useFileDrop"
import { isNativeCapacitor } from "@/platform"

export interface FileDropZoneRenderProps {
  isDragging: boolean
  openFilePicker: () => void
}

export interface FileDropZoneHandle {
  openFilePicker: () => void
}

export interface FileDropZoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop" | "children"> {
  /** Receives files that passed the `accept` / `maxBytes` filters. */
  onFiles: (files: File[]) => void
  /** MIME-type prefixes used to filter dropped files (e.g. `["image/"]`). */
  accept?: string[]
  /** `accept` attribute forwarded to the hidden `<input type="file" />`. */
  acceptInput?: string
  /** Max file size per file, in bytes. Oversize files are silently skipped. */
  maxBytes?: number
  /** Allow multiple file selection through the file picker. */
  multiple?: boolean
  /** Disable all interactions (drag and click). */
  disabled?: boolean
  /** Enable drag handlers. Defaults to true on web, false on native Capacitor. */
  dragEnabled?: boolean
  /** If true, a click on the zone opens the file picker. Defaults to true. */
  clickToBrowse?: boolean
  /** Extra classes applied to the wrapper while a drag is active. */
  dragActiveClassName?: string
  /** Children (node or render prop). */
  children:
    | React.ReactNode
    | ((state: FileDropZoneRenderProps) => React.ReactNode)
}

export const FileDropZone = React.forwardRef<FileDropZoneHandle, FileDropZoneProps>(
  function FileDropZone(
    {
      onFiles,
      accept,
      acceptInput,
      maxBytes,
      multiple = false,
      disabled = false,
      dragEnabled,
      clickToBrowse = true,
      className,
      dragActiveClassName,
      onClick,
      onKeyDown,
      children,
      ...rest
    },
    ref,
  ) {
    const inputRef = React.useRef<HTMLInputElement>(null)

    const resolvedDragEnabled =
      (dragEnabled ?? !isNativeCapacitor()) && !disabled

    const { isDragging, bind } = useFileDrop({
      accept,
      maxBytes,
      enabled: resolvedDragEnabled,
      onFiles,
    })

    const openFilePicker = React.useCallback(() => {
      if (disabled) return
      inputRef.current?.click()
    }, [disabled])

    React.useImperativeHandle(ref, () => ({ openFilePicker }), [openFilePicker])

    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(event.target.files ?? [])
        if (inputRef.current) inputRef.current.value = ""
        if (picked.length === 0) return
        const filtered = picked.filter((file) => {
          if (maxBytes && file.size > maxBytes) return false
          if (!accept || accept.length === 0) return true
          return accept.some((prefix) => file.type.startsWith(prefix))
        })
        if (filtered.length > 0) onFiles(filtered)
      },
      [accept, maxBytes, onFiles],
    )

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (!clickToBrowse || disabled) return
        openFilePicker()
      },
      [clickToBrowse, disabled, onClick, openFilePicker],
    )

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (!clickToBrowse || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openFilePicker()
        }
      },
      [clickToBrowse, disabled, onKeyDown, openFilePicker],
    )

    const content =
      typeof children === "function"
        ? children({ isDragging, openFilePicker })
        : children

    return (
      <div
        {...rest}
        {...bind}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled || undefined}
        data-dragging={isDragging || undefined}
        className={cn(className, isDragging && dragActiveClassName)}
      >
        {content}
        <input
          ref={inputRef}
          type="file"
          accept={acceptInput}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    )
  },
)

export default FileDropZone
