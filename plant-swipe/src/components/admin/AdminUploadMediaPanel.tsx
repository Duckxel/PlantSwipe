import React from "react"
import { CloudUpload, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminUploadPanel } from "@/components/admin/AdminUploadPanel"
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel"

type UploadMediaSection = "upload" | "media"
type MediaBucketView = "utility" | "photos"

const sectionTabs: Array<{
  key: UploadMediaSection
  label: string
  Icon: React.ComponentType<{ className?: string }>
}> = [
  { key: "upload", label: "Upload", Icon: CloudUpload },
  { key: "media", label: "Media library", Icon: ImageIcon },
]

const mediaBucketOptions: Array<{
  key: MediaBucketView
  label: string
}> = [
  { key: "utility", label: "Utility" },
  { key: "photos", label: "Photos" },
]

export const AdminUploadMediaPanel: React.FC = () => {
  const [section, setSection] = React.useState<UploadMediaSection>("upload")
  const [bucketView, setBucketView] = React.useState<MediaBucketView>("utility")

  const bucketFilters = React.useMemo(() => {
    switch (bucketView) {
      case "photos":
        return ["PHOTOS"]
      case "utility":
      default:
        return ["UTILITY"]
    }
  }, [bucketView])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold tracking-wide text-stone-600 dark:text-stone-200">
              Upload and Media
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-300">
              Switch between uploading new assets or reviewing what was already uploaded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sectionTabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
                  section === key
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-stone-100 text-stone-700 hover:text-black dark:bg-[#2d2d30] dark:text-stone-200",
                )}
                onClick={() => setSection(key)}
                aria-pressed={section === key}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {section === "upload" && <AdminUploadPanel />}

      {section === "media" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-4 py-3 dark:border-[#3e3e42] dark:bg-[#1a1a1d]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bucket
              </span>
              <div className="flex flex-wrap gap-2">
                {mediaBucketOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm transition",
                      bucketView === key
                        ? "bg-emerald-600 text-white shadow"
                        : "text-stone-700 hover:text-black dark:text-stone-200 dark:hover:text-white",
                    )}
                    onClick={() => setBucketView(key)}
                    aria-pressed={bucketView === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AdminMediaPanel filterBuckets={bucketFilters} filterLabel={bucketView === "utility" ? "Utility" : "Photos"} />
        </div>
      )}
    </div>
  )
}
