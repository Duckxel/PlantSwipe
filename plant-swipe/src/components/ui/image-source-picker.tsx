/**
 * ImageSourcePicker
 *
 * Shared modal that lets users choose between taking a photo with the
 * camera or picking one from their library. Designed to pair with
 * {@link useImageUpload} + {@link CameraCapture}.
 *
 * Usage:
 *   const [pickerOpen, setPickerOpen] = useState(false)
 *   const [cameraOpen, setCameraOpen] = useState(false)
 *   …
 *   <ImageSourcePicker
 *     open={pickerOpen}
 *     onOpenChange={setPickerOpen}
 *     onCamera={() => setCameraOpen(true)}
 *     onLibrary={imageUpload.openFilePicker}
 *   />
 */

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Camera, Images } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export interface ImageSourcePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the user picks the camera option. */
  onCamera: () => void
  /** Called when the user picks the library / file picker option. */
  onLibrary: () => void
  /** Optional title override. */
  title?: string
  /** Optional description override. */
  description?: string
}

export const ImageSourcePicker: React.FC<ImageSourcePickerProps> = ({
  open,
  onOpenChange,
  onCamera,
  onLibrary,
  title,
  description,
}) => {
  const { t } = useTranslation("common")

  const choose = (fn: () => void) => () => {
    onOpenChange(false)
    // Defer to next tick so this dialog fully unmounts before the next one mounts.
    setTimeout(fn, 50)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {title || t("imageSourcePicker.title", { defaultValue: "Add a photo" })}
          </DialogTitle>
          <DialogDescription>
            {description ||
              t("imageSourcePicker.description", {
                defaultValue: "Take a new photo or choose one from your library.",
              })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={choose(onCamera)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Camera className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
              {t("imageSourcePicker.camera", { defaultValue: "Take Photo" })}
            </span>
          </button>
          <button
            type="button"
            onClick={choose(onLibrary)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Images className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
              {t("imageSourcePicker.library", { defaultValue: "Choose from Library" })}
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ImageSourcePicker
