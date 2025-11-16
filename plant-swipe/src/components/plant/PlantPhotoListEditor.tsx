import React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { PlantPhoto } from "@/types/plant"
import { createEmptyPhoto } from "@/lib/photos"

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
  const radioName = React.useId()
  const list = photos.length > 0 ? photos : [createEmptyPhoto(true)]

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
      }))
    )
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
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={radioName}
                    checked={photo.isPrimary ?? false}
                    onChange={() => setPrimary(index)}
                  />
                  Primary
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={photo.isVertical ?? false}
                    onChange={(e) =>
                      updatePhoto(index, { isVertical: e.target.checked })
                    }
                  />
                  Vertical-friendly
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => removePhoto(index)}
                disabled={list.length === 1}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={addPhoto}
        className="rounded-2xl w-fit"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add photo
      </Button>
    </div>
  )
}
