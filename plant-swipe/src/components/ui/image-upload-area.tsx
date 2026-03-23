/**
 * Shared ImageUploadArea component.
 *
 * Renders a grid of pending image previews with remove buttons and an
 * "add more" trigger.  Designed to work with the useImageUpload hook.
 */

import React from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingImage } from "@/hooks/useImageUpload";

export interface ImageUploadAreaProps {
  /** Pending images from useImageUpload. */
  pending: PendingImage[];
  /** Whether files are currently being uploaded. */
  uploading?: boolean;
  /** Error string (validation / upload). */
  error?: string | null;
  /** Called when the user clicks the "add" button. */
  onAdd: () => void;
  /** Called to remove an image by index. */
  onRemove: (index: number) => void;
  /** Called to dismiss the error. */
  onClearError?: () => void;
  /** Label for the add button (i18n). */
  addLabel?: string;
  /** Label for the remove button (i18n / a11y). */
  removeLabel?: string;
  /** Extra className for the outer wrapper. */
  className?: string;
  /** Size of each thumbnail in the grid (default: "md"). */
  size?: "sm" | "md" | "lg";
  /** Whether to show the add button (default: true). */
  showAddButton?: boolean;
}

const SIZES = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

export const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({
  pending,
  uploading = false,
  error,
  onAdd,
  onRemove,
  onClearError,
  addLabel = "Add",
  removeLabel = "Remove",
  className,
  size = "md",
  showAddButton = true,
}) => {
  const thumbSize = SIZES[size];

  return (
    <div className={cn("space-y-2", className)}>
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="ml-auto hover:text-red-900 dark:hover:text-red-100"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Thumbnail grid */}
      <div className="flex flex-wrap gap-3">
        {pending.map((img, index) => (
          <div
            key={img.previewUrl}
            className={cn(thumbSize, "relative group rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700")}
          >
            <img
              src={img.previewUrl}
              alt={img.file.name}
              className="w-full h-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {!uploading && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                aria-label={removeLabel}
                title={removeLabel}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {/* Add button */}
        {showAddButton && !uploading && (
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              thumbSize,
              "border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-xl flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-amber-400 hover:text-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            )}
            aria-label={addLabel}
            title={addLabel}
          >
            <Upload className="w-6 h-6" />
            <span className="text-xs">{addLabel}</span>
          </button>
        )}

        {/* Uploading indicator in place of add button */}
        {uploading && (
          <div
            className={cn(
              thumbSize,
              "border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-xl flex flex-col items-center justify-center gap-1 text-amber-500",
            )}
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Uploading…</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadArea;
