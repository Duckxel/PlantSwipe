import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/AuthContext"
import { useAuthActions } from "@/context/AuthActionsContext"
import { hasAnyRole, USER_ROLES, checkEditorAccess } from "@/constants/userRoles"
import type { UserRole } from "@/constants/userRoles"
import { useTranslation } from "react-i18next"
import { Image as ImageIcon, Plus, Upload, X, ExternalLink, ShieldCheck, CalendarClock, Sparkles, Megaphone, ChevronDown, ChevronUp, Pencil, Save, Trash2 } from "lucide-react"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { cn } from "@/lib/utils"
import { createPlantProAdvice, deletePlantProAdvice, fetchPlantProAdvices, updatePlantProAdvice, uploadProAdviceImage } from "@/lib/proAdvice"
import type { PlantProAdvice } from "@/types/proAdvice"

type ProAdviceSectionProps = {
  plantId: string
  plantName: string
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

const Avatar: React.FC<{ name?: string | null; src?: string | null }> = ({ name, src }) => {
  const initial = (name || "").trim().charAt(0).toUpperCase() || "P"
  return (
    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center overflow-hidden border border-emerald-200 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800">
      {src ? (
        <img src={src} alt={name || ""} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-sm font-semibold">{initial}</span>
      )}
    </div>
  )
}

const AdviceBadge: React.FC<{ roles?: UserRole[] | null }> = ({ roles }) => {
  if (!roles || roles.length === 0) return null
  if (roles.includes(USER_ROLES.ADMIN)) {
    return <Badge className="rounded-full bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700">Admin</Badge>
  }
  if (roles.includes(USER_ROLES.EDITOR)) {
    return <Badge className="rounded-full bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700">Editor</Badge>
  }
  if (roles.includes(USER_ROLES.PRO)) {
    return <Badge className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700">Pro</Badge>
  }
  return null
}

// Post-it note color schemes - softer pastel colors
const POST_IT_COLORS = [
  { bg: "bg-amber-50", darkBg: "dark:bg-amber-100/80", text: "text-amber-800", darkText: "dark:text-amber-900", shadow: "shadow-amber-200/40" },
  { bg: "bg-rose-50", darkBg: "dark:bg-rose-100/80", text: "text-rose-800", darkText: "dark:text-rose-900", shadow: "shadow-rose-200/40" },
  { bg: "bg-emerald-50", darkBg: "dark:bg-emerald-100/80", text: "text-emerald-800", darkText: "dark:text-emerald-900", shadow: "shadow-emerald-200/40" },
  { bg: "bg-sky-50", darkBg: "dark:bg-sky-100/80", text: "text-sky-800", darkText: "dark:text-sky-900", shadow: "shadow-sky-200/40" },
  { bg: "bg-orange-50", darkBg: "dark:bg-orange-100/80", text: "text-orange-800", darkText: "dark:text-orange-900", shadow: "shadow-orange-200/40" },
  { bg: "bg-violet-50", darkBg: "dark:bg-violet-100/80", text: "text-violet-800", darkText: "dark:text-violet-900", shadow: "shadow-violet-200/40" },
]

// Rotation classes for Post-it effect
const ROTATIONS = [
  "rotate-[-2deg]",
  "rotate-[1.5deg]",
  "rotate-[-1deg]",
  "rotate-[2deg]",
  "rotate-[-0.5deg]",
  "rotate-[1deg]",
]

const getPostItStyle = (index: number) => {
  const color = POST_IT_COLORS[index % POST_IT_COLORS.length]
  const rotation = ROTATIONS[index % ROTATIONS.length]
  return { color, rotation }
}

export const ProAdviceSection: React.FC<ProAdviceSectionProps> = ({ plantId, plantName }) => {
  const { t } = useTranslation("common", { keyPrefix: "moderation.proAdvice" })
  const { t: tCommon } = useTranslation("common")
  const { user, profile } = useAuth()
  const { openLogin } = useAuthActions()
  const navigate = useLanguageNavigate()

  const [advices, setAdvices] = React.useState<PlantProAdvice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [content, setContent] = React.useState("")
  const [referenceUrl, setReferenceUrl] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [formNotice, setFormNotice] = React.useState<{ type: "success" | "error"; text: string } | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)

  // Edit mode state
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editContent, setEditContent] = React.useState("")
  const [editReferenceUrl, setEditReferenceUrl] = React.useState("")
  const [editFile, setEditFile] = React.useState<File | null>(null)
  const [editImageUrl, setEditImageUrl] = React.useState<string | null>(null)
  const [editUploading, setEditUploading] = React.useState(false)
  const [editSubmitting, setEditSubmitting] = React.useState(false)

  const normalizeRoles = React.useCallback((roles?: string[] | null): UserRole[] => {
    if (!roles) return []
    return roles.filter((role): role is UserRole => Object.values(USER_ROLES).includes(role as UserRole))
  }, [])

  const canModerate = React.useMemo(() => checkEditorAccess(profile), [profile])
  const canContribute = React.useMemo(() => {
    if (!profile) return false
    if (profile.is_admin) return true
    const roles = normalizeRoles(profile.roles)
    return hasAnyRole(roles, [USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.PRO])
  }, [normalizeRoles, profile])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchPlantProAdvices(plantId)
        if (!cancelled) setAdvices(rows)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || t("loadError"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [plantId, t])

  React.useEffect(() => {
    if (!canContribute) {
      setFormOpen(false)
    }
  }, [canContribute])

  const resetForm = () => {
    setContent("")
    setReferenceUrl("")
    setFile(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) {
      openLogin()
      return
    }
    if (!canContribute) {
      setFormNotice({ type: "error", text: t("noAccess") })
      return
    }
    const trimmed = content.trim()
    if (!trimmed) {
      setFormNotice({ type: "error", text: t("validation.missingContent") })
      return
    }

    let imageUrl: string | null = null
    setSubmitting(true)
    try {
      if (file) {
        setUploading(true)
        imageUrl = await uploadProAdviceImage(file, { folder: plantId })
      }
      const advice = await createPlantProAdvice({
        plantId,
        authorId: user.id,
        content: trimmed,
        imageUrl,
        referenceUrl: referenceUrl.trim() || null,
        metadata: referenceUrl.trim() ? { reference_url: referenceUrl.trim() } : {},
        authorDisplayName: profile?.display_name || null,
        authorUsername: (profile as any)?.username || null,
        authorAvatarUrl: profile?.avatar_url || null,
        authorRoles: normalizeRoles(profile?.roles),
      })
      setAdvices((prev) => [advice, ...prev])
      setFormNotice({ type: "success", text: t("success") })
      resetForm()
    } catch (err: any) {
      setFormNotice({
        type: "error",
        text: err?.message || t("submitError"),
      })
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) {
      openLogin()
      return
    }
    const advice = advices.find((a) => a.id === id)
    const canDelete = advice && (canModerate || advice.authorId === user.id)
    if (!canDelete) return
    try {
      await deletePlantProAdvice(id)
      setAdvices((prev) => prev.filter((a) => a.id !== id))
      setFormNotice({ type: "success", text: t("deleted") })
    } catch (err: any) {
      setFormNotice({
        type: "error",
        text: err?.message || t("deleteError"),
      })
    }
  }

  const handleProfileClick = (advice: PlantProAdvice) => {
    const slug = advice.authorDisplayName || advice.authorUsername
    if (slug) {
      navigate(`/u/${encodeURIComponent(slug)}`)
    }
  }

  const startEditing = (advice: PlantProAdvice) => {
    setEditingId(advice.id)
    setEditContent(advice.content)
    setEditReferenceUrl(advice.referenceUrl || "")
    setEditImageUrl(advice.imageUrl || null)
    setEditFile(null)
    setFormNotice(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent("")
    setEditReferenceUrl("")
    setEditFile(null)
    setEditImageUrl(null)
  }

  const handleUpdate = async (id: string) => {
    if (!user) {
      openLogin()
      return
    }
    const trimmed = editContent.trim()
    if (!trimmed) {
      setFormNotice({ type: "error", text: t("validation.missingContent") })
      return
    }

    let imageUrl: string | null = editImageUrl
    setEditSubmitting(true)
    try {
      if (editFile) {
        setEditUploading(true)
        imageUrl = await uploadProAdviceImage(editFile, { folder: plantId })
      }

      const updated = await updatePlantProAdvice({
        id,
        content: trimmed,
        imageUrl,
        referenceUrl: editReferenceUrl.trim() || null,
        metadata: editReferenceUrl.trim() ? { reference_url: editReferenceUrl.trim() } : {},
      })

      setAdvices((prev) => prev.map((a) => (a.id === id ? updated : a)))
      setFormNotice({ type: "success", text: t("updated") })
      cancelEditing()
    } catch (err: any) {
      setFormNotice({
        type: "error",
        text: err?.message || t("updateError"),
      })
    } finally {
      setEditUploading(false)
      setEditSubmitting(false)
    }
  }

  const handleRemoveEditImage = () => {
    setEditImageUrl(null)
    setEditFile(null)
  }

  const hasAdvice = advices.length > 0

  if (!canContribute && !loading && !hasAdvice) {
    // Hide the entire section for viewers without permissions when no advice exists
    return null
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-4 sm:p-6 shadow-lg dark:border-emerald-800/60 dark:from-[#04281f] dark:via-[#0b1b1a] dark:to-[#0e2f28]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_40%)] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm ring-1 ring-emerald-200/70 dark:bg-white/5 dark:text-emerald-200 dark:ring-emerald-700/40">
              <Sparkles className="h-3.5 w-3.5" />
              {t("eyebrow")}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">{t("title")}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-300 max-w-2xl">
              {t("subtitle")}
            </p>
          </div>
          <ShieldCheck className="h-10 w-10 text-emerald-500 drop-shadow-md" />
        </div>

        {canContribute && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200/70 bg-white/80 p-3 sm:p-4 shadow-inner dark:border-emerald-700/50 dark:bg-[#0f1f1f]/80">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-transparent dark:text-emerald-200"
                onClick={() => {
                  setFormOpen((prev) => !prev)
                  setFormNotice(null)
                }}
              >
                {formOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {formOpen ? tCommon("close", { defaultValue: "Close" }) : t("submit")}
              </Button>
            </div>

            {formOpen && (
              <form
                className="relative mt-2 space-y-3 rounded-2xl border border-emerald-200/70 bg-white/80 p-3 sm:p-4 shadow-inner dark:border-emerald-700/50 dark:bg-[#0f1f1f]/80"
                onSubmit={handleSubmit}
              >
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-100">
                    <Megaphone className="h-4 w-4 text-emerald-600" />
                    {t("contentLabel")}
                  </label>
                  <Textarea
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value)
                      setFormNotice(null)
                    }}
                    placeholder={t("placeholder", { plant: plantName })}
                    rows={4}
                    className="rounded-xl border-emerald-200/70 focus:ring-emerald-400 dark:border-emerald-700/60 dark:bg-[#0f1816]"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-200">{t("referenceLabel")}</label>
                    <Input
                      value={referenceUrl}
                      onChange={(e) => {
                        setReferenceUrl(e.target.value)
                        setFormNotice(null)
                      }}
                      placeholder="https://"
                      type="url"
                      className="rounded-xl border-emerald-200/70 focus:ring-emerald-400 dark:border-emerald-700/60 dark:bg-[#0f1816]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-200">{t("imageLabel")}</label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm cursor-pointer transition hover:-translate-y-[1px] hover:shadow dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100">
                        <Upload className="h-4 w-4" />
                        <span>{file ? file.name : t("pickImage")}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            setFile(e.target.files?.[0] || null)
                            setFormNotice(null)
                          }}
                        />
                      </label>
                      {file && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} aria-label={t("clearImage")}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {formNotice && (
                  <div
                    className={cn(
                      "text-xs rounded-lg px-3 py-2",
                      formNotice.type === "success"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                        : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200"
                    )}
                  >
                    {formNotice.text}
                  </div>
                )}
                <div className="flex items-center justify-end">
                  <Button type="submit" disabled={submitting || uploading} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    {uploading ? t("uploading") : t("submit")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Loading/Error/Empty States */}
      {loading && (
        <Card className="rounded-xl border-stone-200 dark:border-stone-700">
          <CardContent className="p-4 text-sm text-stone-500 dark:text-stone-400">{t("loading")}</CardContent>
        </Card>
      )}
      {error && (
        <Card className="rounded-xl border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-200">{error}</CardContent>
        </Card>
      )}
      {!loading && !error && advices.length === 0 && canContribute && (
        <Card className="rounded-xl border-dashed border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardContent className="p-4 text-sm text-stone-700 dark:text-stone-200 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-emerald-500" />
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {/* Post-it Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-4">

        {advices.map((advice, index) => {
          const canEdit = user && (canModerate || advice.authorId === user.id)
          const isEditing = editingId === advice.id
          const { color, rotation } = getPostItStyle(index)

          if (isEditing) {
            return (
              <div key={advice.id} className="col-span-1 sm:col-span-2 lg:col-span-3">
                <Card className="overflow-hidden rounded-lg border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 shadow-lg dark:border-amber-500/60 dark:from-amber-200 dark:via-yellow-100 dark:to-amber-200">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={advice.authorDisplayName || advice.authorUsername} src={advice.authorAvatarUrl} />
                        <div>
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-950">
                            {advice.authorDisplayName || advice.authorUsername || t("unknownAuthor")}
                          </span>
                          <AdviceBadge roles={advice.authorRoles || []} />
                        </div>
                      </div>
                      <Badge className="rounded-full bg-amber-300 text-amber-900 border-amber-400">
                        <Pencil className="h-3 w-3 mr-1" />
                        {t("editing")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                        <Megaphone className="h-4 w-4 text-amber-700" />
                        {t("contentLabel")}
                      </label>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder={t("placeholder", { plant: plantName })}
                        rows={4}
                        className="rounded-lg border-amber-300 bg-white/80 focus:ring-amber-400 text-amber-900"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-amber-800">{t("referenceLabel")}</label>
                        <Input
                          value={editReferenceUrl}
                          onChange={(e) => setEditReferenceUrl(e.target.value)}
                          placeholder="https://"
                          type="url"
                          className="rounded-lg border-amber-300 bg-white/80 focus:ring-amber-400 text-amber-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-amber-800">{t("imageLabel")}</label>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm cursor-pointer transition hover:-translate-y-[1px] hover:shadow">
                            <Upload className="h-4 w-4" />
                            <span>{editFile ? editFile.name : t("pickImage")}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                            />
                          </label>
                          {(editFile || editImageUrl) && (
                            <Button type="button" variant="ghost" size="icon" onClick={handleRemoveEditImage} aria-label={t("clearImage")} className="text-amber-700 hover:bg-amber-200">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {editImageUrl && !editFile && (
                      <div className="overflow-hidden rounded-lg border border-amber-300 bg-white/50">
                        <img src={editImageUrl} alt={`${plantName} pro advice`} className="w-full max-h-40 object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                        className="rounded-full border-amber-400 text-amber-800 hover:bg-amber-100"
                      >
                        <X className="h-4 w-4 mr-2" />
                        {tCommon("cancel", { defaultValue: "Cancel" })}
                      </Button>
                      <Button
                        type="button"
                        disabled={editSubmitting || editUploading}
                        onClick={() => handleUpdate(advice.id)}
                        className="rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {editUploading ? t("uploading") : t("save")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          }

          return (
            <div
              key={advice.id}
              className={cn(
                "group relative transition-all duration-300 hover:scale-105 hover:z-10",
                rotation
              )}
            >
              {/* Push pin effect */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                <div className="w-4 h-4 rounded-full bg-red-500 shadow-md border-2 border-red-600 dark:bg-red-400 dark:border-red-500" />
                <div className="w-1 h-2 bg-gradient-to-b from-stone-400 to-stone-500 mx-auto -mt-0.5" />
              </div>
              
              {/* Post-it note card */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-sm pt-4 pb-3 px-4 min-h-[180px]",
                  "shadow-[4px_4px_10px_rgba(0,0,0,0.15)] hover:shadow-[6px_6px_15px_rgba(0,0,0,0.2)]",
                  "border-b-4 border-r-4 border-black/5",
                  color.bg, color.darkBg
                )}
                style={{
                  backgroundImage: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)"
                }}
              >
                {/* Folded corner effect */}
                <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-b-[20px] border-b-white/40 dark:border-b-white/20" />
                
                {/* Content */}
                <div className="relative space-y-3">
                  {/* Header with author info */}
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => handleProfileClick(advice)}
                      className="focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-full flex-shrink-0"
                      aria-label={t("goToProfile", { name: advice.authorDisplayName || advice.authorUsername || "" })}
                    >
                      <Avatar name={advice.authorDisplayName || advice.authorUsername} src={advice.authorAvatarUrl} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleProfileClick(advice)}
                          className={cn("text-sm font-bold hover:underline truncate", color.text, color.darkText)}
                        >
                          {advice.authorDisplayName || advice.authorUsername || t("unknownAuthor")}
                        </button>
                        <AdviceBadge roles={advice.authorRoles || []} />
                      </div>
                      <p className={cn("text-[10px] flex items-center gap-1 opacity-70", color.text, color.darkText)}>
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(advice.createdAt).split(',')[0]}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEditing(advice)} aria-label={t("edit")} className={cn("h-7 w-7", color.text, color.darkText, "hover:bg-black/10")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(advice.id)} aria-label={t("delete")} className="h-7 w-7 text-red-600 hover:bg-red-100/50 dark:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Content text */}
                  <p className={cn("text-sm whitespace-pre-line leading-relaxed font-medium", color.text, color.darkText)}>
                    {advice.content}
                  </p>

                  {/* Image if present */}
                  {advice.imageUrl && (
                    <div className="overflow-hidden rounded-lg border-2 border-white/50 shadow-inner">
                      <img src={advice.imageUrl} alt={`${plantName} pro advice`} className="w-full max-h-32 object-cover" loading="lazy" />
                    </div>
                  )}

                  {/* Reference link */}
                  {advice.referenceUrl && (
                    <a
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold hover:underline",
                        color.text, color.darkText
                      )}
                      href={advice.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("referenceLink")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
