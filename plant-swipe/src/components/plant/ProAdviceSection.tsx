import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/AuthContext"
import { useAuthActions } from "@/context/AuthActionsContext"
import { hasAnyRole, USER_ROLES } from "@/constants/userRoles"
import type { UserRole } from "@/constants/userRoles"
import { useTranslation } from "react-i18next"
import { Image as ImageIcon, Plus, Upload, X, ExternalLink, ShieldCheck, CalendarClock, Sparkles, Megaphone, ChevronDown, ChevronUp } from "lucide-react"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { cn } from "@/lib/utils"
import { createPlantProAdvice, deletePlantProAdvice, fetchPlantProAdvices, uploadProAdviceImage } from "@/lib/proAdvice"
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

  const normalizeRoles = React.useCallback((roles?: string[] | null): UserRole[] => {
    if (!roles) return []
    return roles.filter((role): role is UserRole => Object.values(USER_ROLES).includes(role as UserRole))
  }, [])

  const canModerate = React.useMemo(() => {
    if (!profile) return false
    if (profile.is_admin) return true
    const roles = normalizeRoles(profile.roles)
    return hasAnyRole(roles, [USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.PRO])
  }, [normalizeRoles, profile])
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

  const hasAdvice = advices.length > 0

  if (!canContribute && !loading && !hasAdvice) {
    // Hide the entire section for viewers without permissions when no advice exists
    return null
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-4 sm:p-6 shadow-lg dark:border-emerald-800/60 dark:from-[#04281f] dark:via-[#0b1b1a] dark:to-[#0e2f28]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_40%)]" />
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
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-emerald-800 dark:text-emerald-200">
              <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500 shadow">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                {t("title")}
              </Badge>
              <Badge className="rounded-full bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700">
                <Megaphone className="h-3.5 w-3.5 mr-1" />
                {t("helper")}
              </Badge>
            </div>
          </div>
          <ShieldCheck className="h-10 w-10 text-emerald-500 drop-shadow-md" />
        </div>

        {canContribute && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200/70 bg-white/80 p-3 sm:p-4 shadow-inner dark:border-emerald-700/50 dark:bg-[#0f1f1f]/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-stone-600 dark:text-stone-300 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-emerald-600" />
                {t("helper")}
              </p>
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
                <div className="flex items-center justify-between">
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {uploading ? t("uploading") : t("helper")}
                  </div>
                  <Button type="submit" disabled={submitting || uploading} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("submit")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
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

        {advices.map((advice) => {
          const canDelete = user && (canModerate || advice.authorId === user.id)
          return (
            <Card key={advice.id} className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-white via-emerald-50 to-white shadow-md transition hover:-translate-y-1 hover:shadow-lg dark:border-emerald-800/40 dark:from-[#0c1615] dark:via-[#0f201d] dark:to-[#0d1818]">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleProfileClick(advice)}
                    className="focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full"
                    aria-label={t("goToProfile", { name: advice.authorDisplayName || advice.authorUsername || "" })}
                  >
                    <Avatar name={advice.authorDisplayName || advice.authorUsername} src={advice.authorAvatarUrl} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleProfileClick(advice)}
                        className="text-sm font-semibold text-stone-900 hover:text-emerald-700 dark:text-stone-100 dark:hover:text-emerald-300"
                      >
                        {advice.authorDisplayName || advice.authorUsername || t("unknownAuthor")}
                      </button>
                      <AdviceBadge roles={advice.authorRoles || []} />
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t("postedAt", { date: formatDate(advice.createdAt) })}
                    </p>
                  </div>
                  {canDelete && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(advice.id)} aria-label={t("delete")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                <p className="text-sm text-stone-800 whitespace-pre-line leading-relaxed dark:text-stone-100">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-100 mr-2">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {t("title")}
                  </span>
                  {advice.content}
                </p>
                {advice.imageUrl && (
                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-[#1c1c1c]">
                    <img src={advice.imageUrl} alt={`${plantName} pro advice`} className="w-full max-h-80 object-cover" loading="lazy" />
                  </div>
                )}
                {advice.referenceUrl && (
                  <a
                    className={cn(
                      "inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 hover:underline",
                      "dark:text-emerald-300 dark:hover:text-emerald-200"
                    )}
                    href={advice.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("referenceLink")}
                  </a>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
