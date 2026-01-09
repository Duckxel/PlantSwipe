import React from "react"
import { CloudUpload, Inbox } from "lucide-react"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { AdminUploadPanel } from "@/components/admin/AdminUploadPanel"
import { GlobalImageLibrary } from "@/components/admin/GlobalImageLibrary"
import { Link } from "@/components/i18n/Link"

type UploadMediaSection = "upload" | "library"

const sectionTabs: Array<{
  key: UploadMediaSection
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  path: string
}> = [
  { key: "upload", label: "Upload", description: "Add new files", Icon: CloudUpload, path: "/admin/upload" },
  { key: "library", label: "Library", description: "Global image database", Icon: Inbox, path: "/admin/upload/library" },
]

export const AdminUploadMediaPanel: React.FC = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const section: UploadMediaSection = React.useMemo(() => {
    if (currentPath.includes("/admin/upload/library")) return "library"
    return "upload"
  }, [currentPath])

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Media Center</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Upload and manage media files across the platform
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
      {section === "library" && <GlobalImageLibrary />}
    </div>
  )
}
