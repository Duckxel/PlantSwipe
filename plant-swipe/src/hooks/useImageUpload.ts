/**
 * Shared hook for image selection, validation, preview, and upload.
 *
 * Centralises the file-picking / uploading logic that was previously
 * duplicated across GardenJournalSection, ConversationView, etc.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PendingImage {
  file: File;
  previewUrl: string;
}

export interface ImageUploadOptions {
  /** Allowed MIME types (default: common image types). */
  allowedTypes?: string[];
  /** Max file size in bytes (default: 15 MB). */
  maxSizeBytes?: number;
  /** Max number of images that can be pending at once (default: 10). */
  maxFiles?: number;
  /** Allow selecting multiple files at once (default: true). */
  multiple?: boolean;
}

export interface UploadTarget {
  /** Full URL to POST the file to. */
  url: string;
  /** Extra headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Extra form-data fields to append alongside the file. */
  extraFields?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  path?: string;
}

const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
];

const DEFAULT_MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const DEFAULT_MAX_FILES = 10;

// ── Hook ───────────────────────────────────────────────────────────────────

export function useImageUpload(options?: ImageUploadOptions) {
  const {
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    maxSizeBytes = DEFAULT_MAX_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    multiple = true,
  } = options ?? {};

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Open the native file picker ──────────────────────────────────────

  const openFilePicker = useCallback(() => {
    // Reset value so re-selecting the same file fires onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  }, []);

  // ── Handle <input type="file"> onChange ──────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // Always reset so the same file can be picked again later
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setError(null);

      // Validate each file
      const valid: PendingImage[] = [];
      for (const file of files) {
        // Type check
        if (!allowedTypes.includes(file.type) && file.type !== "") {
          // file.type can be "" on some mobile browsers for HEIC – allow it
          setError(`Unsupported file type: ${file.type}`);
          continue;
        }
        // Size check
        if (file.size > maxSizeBytes) {
          const limitMB = Math.round(maxSizeBytes / 1024 / 1024);
          setError(`File too large (max ${limitMB} MB): ${file.name}`);
          continue;
        }
        valid.push({ file, previewUrl: URL.createObjectURL(file) });
      }

      if (valid.length === 0) return;

      setPending((prev) => {
        const combined = [...prev, ...valid];
        // Trim to maxFiles – revoke excess URLs
        if (combined.length > maxFiles) {
          const excess = combined.splice(0, combined.length - maxFiles);
          excess.forEach((p) => URL.revokeObjectURL(p.previewUrl));
          setError(`Only ${maxFiles} images allowed – oldest removed.`);
        }
        return combined;
      });
    },
    [allowedTypes, maxSizeBytes, maxFiles],
  );

  // ── Add a File directly (e.g. from CameraCapture) ───────────────────

  const addFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > maxSizeBytes) {
        const limitMB = Math.round(maxSizeBytes / 1024 / 1024);
        setError(`File too large (max ${limitMB} MB)`);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => {
        const combined = [...prev, { file, previewUrl }];
        if (combined.length > maxFiles) {
          const excess = combined.splice(0, combined.length - maxFiles);
          excess.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        }
        return combined;
      });
    },
    [maxSizeBytes, maxFiles],
  );

  // ── Remove a pending image by index ──────────────────────────────────

  const removePending = useCallback((index: number) => {
    setPending((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }, []);

  // ── Clear all pending images ─────────────────────────────────────────

  const clearAll = useCallback(() => {
    setPending((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setError(null);
  }, []);

  // ── Upload all pending images to the server ──────────────────────────

  const uploadAll = useCallback(
    async (target: UploadTarget): Promise<UploadResult[]> => {
      if (pending.length === 0) return [];
      setUploading(true);
      setError(null);

      const results: UploadResult[] = [];
      const failed: string[] = [];

      for (const { file } of pending) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          if (target.extraFields) {
            for (const [k, v] of Object.entries(target.extraFields)) {
              formData.append(k, v);
            }
          }

          const resp = await fetch(target.url, {
            method: "POST",
            headers: target.headers ?? {},
            body: formData,
            credentials: "same-origin",
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data?.url) {
              results.push({ url: data.url, path: data.path });
            } else {
              failed.push(file.name);
            }
          } else {
            failed.push(file.name);
          }
        } catch {
          failed.push(file.name);
        }
      }

      setUploading(false);

      if (failed.length > 0) {
        setError(`Failed to upload: ${failed.join(", ")}`);
      }

      // Revoke preview URLs for successfully uploaded images
      // (caller should call clearAll after processing results)
      return results;
    },
    [pending],
  );

  // ── The hidden <input> props (spread onto an <input>) ────────────────

  const inputProps = {
    ref: fileInputRef,
    type: "file" as const,
    accept: allowedTypes.join(","),
    multiple,
    onChange: handleFileChange,
    className: "hidden" as const,
    "aria-hidden": true as const,
    tabIndex: -1 as const,
  };

  return {
    /** Props to spread onto a hidden <input> element. */
    inputProps,
    /** Currently selected images (not yet uploaded). */
    pending,
    /** Whether an upload is in progress. */
    uploading,
    /** Last validation / upload error message. */
    error,
    /** Clear the error. */
    clearError: () => setError(null),
    /** Open the native file picker programmatically. */
    openFilePicker,
    /** Add a File directly (e.g. from camera capture). */
    addFile,
    /** Remove a pending image by index. */
    removePending,
    /** Remove all pending images and revoke URLs. */
    clearAll,
    /** Upload all pending images to the given target. Returns URLs. */
    uploadAll,
  };
}
