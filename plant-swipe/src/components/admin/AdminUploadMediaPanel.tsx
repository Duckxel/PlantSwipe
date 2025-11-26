import React from "react"
import { CloudUpload, ImageIcon, FolderOpen, HardDrive } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { AdminUploadPanel } from "@/components/admin/AdminUploadPanel"
import { AdminMediaPanel } from "@/components/admin/AdminMediaPanel"

type UploadMediaSection = "upload" | "media"
type MediaBucketView = "utility" | "photos"

const sectionTabs: Array<{
  key: UploadMediaSection
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  path: string
}> = [
  { key: "upload", label: "Upload", description: "Add new files", Icon: CloudUpload, path: "/admin/upload" },
  { key: "media", label: "Library", description: "Browse files", Icon: ImageIcon, path: "/admin/upload/library" },
]

const mediaBucketOptions: Array<{
  key: MediaBucketView
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: "utility", label: "Utility", icon: FolderOpen },
  { key: "photos", label: "Photos", icon: HardDrive },
]

export const AdminUploadMediaPanel: React.FC = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const section: UploadMediaSection = React.useMemo(() => {
    if (currentPath.includes("/admin/upload/library")) return "media"
    return "upload"
  }, [currentPath])
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
      {/* Header with Navigation */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Media Center</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Upload and manage media files
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2">
          {sectionTabs.map(({ key, label, Icon, path }) => (
            <Link
              key={key}
              to={path}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                section === key
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      {section === "upload" && <AdminUploadPanel />}

      {section === "media" && (
        <div className="space-y-6">
          {/* Bucket Filter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Bucket:
            </span>
            <div className="flex gap-2">
              {mediaBucketOptions.map(({ key, label, icon: BucketIcon }) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    bucketView === key
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-white dark:bg-[#1e1e20] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[#3e3e42] hover:border-emerald-300 dark:hover:border-emerald-800"
                  )}
                  onClick={() => setBucketView(key)}
                >
                  <BucketIcon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <AdminMediaPanel 
            filterBuckets={bucketFilters} 
            filterLabel={bucketView === "utility" ? "Utility" : "Photos"} 
          />
        </div>
      )}
    </div>
  )
}
