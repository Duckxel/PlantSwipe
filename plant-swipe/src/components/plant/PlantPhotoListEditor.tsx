import React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { PlantPhoto } from "@/types/plant"
import { createEmptyPhoto, MAX_PLANT_PHOTOS } from "@/lib/photos"

interface PlantPhotoListEditorProps {
  photos: PlantPhoto[]
  onChange: (next: PlantPhoto[]) => void
  label?: React.ReactNode
  helperText?: React.ReactNode
}

export const PlantPhotoListEditor: React.FC<PlantPhotoListEditorProps> = ({
  photos,
  onChange,
  label,
  helperText,
}) => {
  const list = photos.length > 0 ? photos : [createEmptyPhoto(true)]
  const hasBlankPlaceholder = list.some((photo) => !photo.url || !photo.url.trim())
  const filledCount = list.filter((photo) => photo.url && photo.url.trim()).length
  const canAddMore = !hasBlankPlaceholder && filledCount < MAX_PLANT_PHOTOS

  const updatePhoto = (index: number, patch: Partial<PlantPhoto>) => {
    onChange(
      list.map((photo, idx) => (idx === index ? { ...photo, ...patch } : photo))
    )
  }

  const setPrimary = (index: number) => {
    onChange(
      list.map((photo, idx) => ({
        ...photo,
        isPrimary: idx === index,
        isVertical: idx === index ? false : photo.isVertical,
      }))
    )
  }

  const setVertical = (index: number, next: boolean) => {
    if (!next) {
      onChange(
        list.map((photo, idx) =>
          idx === index ? { ...photo, isVertical: false } : photo
        )
      )
      return
    }
    onChange(
      list.map((photo, idx) => ({
        ...photo,
        isVertical: idx === index,
        isPrimary: idx === index ? false : photo.isPrimary,
      }))
    )
  }

  const setRole = (index: number, role: "primary" | "vertical" | "other") => {
    if (role === "primary") {
      setPrimary(index)
    } else if (role === "vertical") {
      setVertical(index, true)
    } else {
      onChange(
        list.map((photo, idx) =>
          idx === index ? { ...photo, isPrimary: false, isVertical: false } : photo
        )
      )
    }
  }

  const removePhoto = (index: number) => {
    if (list.length === 1) {
      onChange([createEmptyPhoto(true)])
      return
    }
    const next = list.filter((_, idx) => idx !== index)
    if (!next.some((photo) => photo.isPrimary) && next.length > 0) {
      next[0] = { ...next[0], isPrimary: true }
    }
    onChange(next)
  }

  const addPhoto = () => {
    if (!canAddMore) return
    onChange([
      ...list,
      createEmptyPhoto(list.every((photo) => !photo.isPrimary)),
    ])
  }

  const resolvedLabel = label ?? (
    <>
      Photos <span className="text-red-500">*</span>
    </>
  )
  const resolvedHelper =
    helperText ??
    "Add at least one image URL. Mark one as primary for cards and flag vertical-friendly shots for portrait layouts."

  return (
    <div className="grid gap-2">
      <Label>{resolvedLabel}</Label>
      {resolvedHelper && (
        <p className="text-xs text-muted-foreground">{resolvedHelper}</p>
      )}
      <div className="space-y-3">
        {list.map((photo, index) => (
          <div
            key={index}
            className="rounded-2xl border border-stone-200 p-3 dark:border-[#3e3e42]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                autoComplete="off"
                value={photo.url}
                onChange={(e) => updatePhoto(index, { url: e.target.value })}
                placeholder="https://example.com/photo.jpg"
                aria-label={`Photo URL ${index + 1}`}
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <Select
                  value={
                    photo.isPrimary
                      ? "primary"
                      : photo.isVertical
                      ? "vertical"
                      : "other"
                  }
                  onChange={(e) =>
                    setRole(index, e.target.value as "primary" | "vertical" | "other")
                  }
                  className="h-9 w-[140px] rounded-md px-3 py-1 text-sm"
                  aria-label={`Photo role ${index + 1}`}
                >
                  <option value="primary">Primary</option>
                  <option value="vertical">Vertical</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => removePhoto(index)}
                disabled={list.length === 1}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                aria-label={`Remove photo ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={addPhoto}
          className="rounded-2xl w-fit"
          disabled={!canAddMore}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add photo
        </Button>
        <span className="text-xs text-muted-foreground">
          {filledCount}/{MAX_PLANT_PHOTOS} photos
        </span>
      </div>
    </div>
  )
}
