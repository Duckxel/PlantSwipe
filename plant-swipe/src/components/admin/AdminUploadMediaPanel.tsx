import React from "react"
import { CloudUpload, Inbox, Smartphone, Layers, ChevronRight } from "lucide-react"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { AdminUploadPanel } from "@/components/admin/AdminUploadPanel"
import { GlobalImageLibrary } from "@/components/admin/GlobalImageLibrary"
import { AdminMockupsPanel } from "@/components/admin/AdminMockupsPanel"
import { Link } from "@/components/i18n/Link"

type UploadMediaSection = "upload" | "library" | "mockups"

const sectionTabs: Array<{
  key: UploadMediaSection
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  path: string
}> = [
  { key: "upload", label: "Upload", description: "Add new files", Icon: CloudUpload, path: "/admin/upload" },
  { key: "library", label: "Library", description: "Global image database", Icon: Inbox, path: "/admin/upload/library" },
  { key: "mockups", label: "Mockups", description: "PWA screenshots & mockups", Icon: Smartphone, path: "/admin/upload/mockups" },
]

export const AdminUploadMediaPanel: React.FC = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const section: UploadMediaSection = React.useMemo(() => {
    if (currentPath.includes("/admin/upload/library")) return "library"
    if (currentPath.includes("/admin/upload/mockups")) return "mockups"
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
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Plant Image Dump shortcut */}
      <Link
        to="/admin/upload/dump"
        className="flex items-center gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-4 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors group"
      >
        <div className="h-10 w-10 rounded-xl bg-emerald-600 dark:bg-emerald-700 flex items-center justify-center flex-shrink-0">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Plant Image Dump</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Bulk-upload hundreds of plant images, group them, assign plants, and submit in one workflow
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* Content */}
      {section === "upload" && <AdminUploadPanel />}
      {section === "library" && <GlobalImageLibrary />}
      {section === "mockups" && <AdminMockupsPanel />}
    </div>
  )
}
