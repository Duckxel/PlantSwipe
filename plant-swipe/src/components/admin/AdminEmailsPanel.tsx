import React from "react"
import "./AdminEmailsPanel.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Plus,
  RefreshCw,
  Send,
  Clock,
  Trash2,
  Play,
  Square,
  Loader2,
} from "lucide-react"
import type { JSONContent } from "@tiptap/core"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"
import { useNavigate, useLocation, Link } from "react-router-dom"

type EmailTemplate = {
  id: string
  title: string
  subject: string
  description: string | null
  previewText: string | null
  bodyHtml: string
  bodyJson: JSONContent | null
  variables: string[]
  isActive: boolean
  version: number
  lastUsedAt: string | null
  campaignCount: number
  createdAt: string
  updatedAt: string
}

type EmailCampaign = {
  id: string
  title: string
  description: string | null
  status: string
  templateId: string | null
  templateTitle: string | null
  subject: string
  previewText: string | null
  variables: string[]
  timezone: string
  scheduledFor: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  sendError: string | null
  sendStartedAt: string | null
  sendCompletedAt: string | null
  createdAt: string
  updatedAt: string
}

async function buildAdminHeaders() {
  const session = (await supabase.auth.getSession()).data.session
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
  if (adminToken) headers["X-Admin-Token"] = adminToken
  return headers
}

const DEFAULT_TIMEZONE =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

const formatStatus = (status: string) => {
  switch (status) {
    case "scheduled":
      return "Scheduled"
    case "draft":
      return "Draft"
    case "running":
      return "Sending"
    case "sent":
      return "Sent"
    case "cancelled":
      return "Cancelled"
    case "partial":
      return "Partial"
    case "failed":
      return "Failed"
    default:
      return status
  }
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800"
    case "running":
      return "bg-amber-100 text-amber-800"
    case "sent":
      return "bg-emerald-100 text-emerald-800"
    case "partial":
      return "bg-purple-100 text-purple-800"
    case "failed":
      return "bg-rose-100 text-rose-800"
    case "cancelled":
      return "bg-slate-200 text-slate-700"
    default:
      return "bg-stone-200 text-stone-700"
  }
}

export const AdminEmailsPanel: React.FC = () => {
  const navigate = useNavigate()
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([])
  const [campaigns, setCampaigns] = React.useState<EmailCampaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = React.useState(false)

  const [campaignForm, setCampaignForm] = React.useState({
    title: "",
    templateId: "",
    scheduledFor: "",
    timezone: DEFAULT_TIMEZONE,
    description: "",
    previewText: "",
  })
  const [campaignSaving, setCampaignSaving] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const location = useLocation()
  const activeView = location.pathname.includes("/templates") ? "templates" : "campaigns"
  const [loadingTemplates, setLoadingTemplates] = React.useState(false)

  const loadTemplates = React.useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch("/api/admin/email-templates", { headers, credentials: "same-origin" })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || "Failed to load templates")
      setTemplates(Array.isArray(data?.templates) ? data.templates : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  const loadCampaigns = React.useCallback(async () => {
    setLoadingCampaigns(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch("/api/admin/email-campaigns", { headers, credentials: "same-origin" })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || "Failed to load campaigns")
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCampaigns(false)
    }
  }, [])

  React.useEffect(() => {
    if (activeView === "campaigns") loadCampaigns().catch(() => {})
    if (activeView === "templates") loadTemplates().catch(() => {})
    // Always load templates once for the campaign dropdown
    loadTemplates().catch(() => {}) 
  }, [activeView, loadTemplates, loadCampaigns])

  const handleCreateCampaign = React.useCallback(async () => {
    if (!campaignForm.title.trim() || !campaignForm.templateId || !campaignForm.scheduledFor) {
      alert("Campaign title, template, and schedule are required.")
      return
    }
    setCampaignSaving(true)
    try {
      const headers = await buildAdminHeaders()
      const payload = {
        title: campaignForm.title.trim(),
        templateId: campaignForm.templateId,
        scheduledFor: new Date(campaignForm.scheduledFor).toISOString(),
        timezone: campaignForm.timezone || DEFAULT_TIMEZONE,
        description: campaignForm.description.trim(),
        previewText: campaignForm.previewText.trim(),
      }
      const resp = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || "Failed to create campaign")
      setCampaignForm({
        title: "",
        templateId: "",
        scheduledFor: "",
        timezone: campaignForm.timezone,
        description: "",
        previewText: "",
      })
      setSheetOpen(false)
      loadCampaigns().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setCampaignSaving(false)
    }
  }, [campaignForm, loadCampaigns])

  const handleRunCampaign = React.useCallback(
    async (campaign: EmailCampaign) => {
      if (!window.confirm(`Send campaign "${campaign.title}" now?`)) return
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-campaigns/${encodeURIComponent(campaign.id)}/run`, {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({}),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to trigger send")
        loadCampaigns().catch(() => {})
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [loadCampaigns],
  )

  const handleCancelCampaign = React.useCallback(
    async (campaign: EmailCampaign) => {
      if (!window.confirm(`Cancel campaign "${campaign.title}"?`)) return
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-campaigns/${encodeURIComponent(campaign.id)}/cancel`, {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({}),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to cancel campaign")
        loadCampaigns().catch(() => {})
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [loadCampaigns],
  )

  const handleDeleteCampaign = React.useCallback(
    async (campaign: EmailCampaign) => {
      const isSent = campaign.status === "sent" || campaign.status === "partial"
      const confirmMsg = isSent 
        ? `WARNING: This campaign "${campaign.title}" has already been sent to ${campaign.sentCount} users.\n\nDeleting it will remove the record of these emails being sent.\n\nAre you sure you want to delete it?`
        : `Delete campaign "${campaign.title}"? This cannot be undone.`
      
      if (!window.confirm(confirmMsg)) return
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-campaigns/${encodeURIComponent(campaign.id)}`, {
          method: "DELETE",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({}),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to delete campaign")
        loadCampaigns().catch(() => {})
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [loadCampaigns],
  )

  const handleDeleteTemplate = React.useCallback(
    async (template: EmailTemplate) => {
      if (!window.confirm(`Delete template "${template.title}"?`)) return
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-templates/${encodeURIComponent(template.id)}`, {
          method: "DELETE",
          headers,
          credentials: "same-origin",
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to delete template")
        loadTemplates().catch(() => {})
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [loadTemplates],
  )

  return (
    <div className="space-y-6">
      {/* Top Menu / Tabs */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#1a1a1d]/80 px-1 py-1 backdrop-blur">
          <Link
            to="/admin/emails"
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              activeView === "campaigns"
                ? "bg-emerald-600 text-white shadow"
                : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"
            }`}
          >
            Campaigns
          </Link>
          <Link
            to="/admin/emails/templates"
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
              activeView === "templates"
                ? "bg-emerald-600 text-white shadow"
                : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white"
            }`}
          >
            Templates
          </Link>
        </div>
      </div>

      {activeView === "campaigns" && (
        <>
          <div className="flex items-center justify-end mb-4">
            <Button className="rounded-2xl" onClick={() => setSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Campaigns</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Schedule broadcasts that send a selected template to every user.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => loadCampaigns().catch(() => {})}>
                {loadingCampaigns ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns...
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No campaigns have been scheduled yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-2xl border border-stone-200 p-4 dark:border-stone-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">{campaign.title}</h3>
                            <Badge className={cn("text-xs", statusBadgeClass(campaign.status))}>
                              {formatStatus(campaign.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {campaign.templateTitle || "Template removed"} · {campaign.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRunCampaign(campaign)}
                            disabled={campaign.status === "running"}
                          >
                            <Play className="mr-2 h-4 w-4" /> Send now
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCancelCampaign(campaign)}>
                            <Square className="mr-2 h-4 w-4" /> Cancel
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCampaign(campaign)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {campaign.scheduledFor ? formatDateTime(campaign.scheduledFor) : "No schedule"}
                        </span>
                        <span className="font-medium text-foreground">
                          Sent: {campaign.sentCount} / {campaign.totalRecipients}
                          {campaign.failedCount > 0 ? ` · Failed ${campaign.failedCount}` : ""}
                        </span>
                        {campaign.variables?.length ? (
                          <span className="flex items-center gap-1">
                            Variables:
                            {campaign.variables.map((variable) => (
                              <Badge key={`${campaign.id}-${variable}`} variant="secondary">
                                {variable}
                              </Badge>
                            ))}
                          </span>
                        ) : null}
                        {campaign.sendError ? (
                          <span className="text-rose-500">Error: {campaign.sendError}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeView === "templates" && (
        <>
          <div className="flex items-center justify-end mb-4">
            <Button
              className="rounded-2xl"
              onClick={() => navigate("/admin/emails/templates/create")}
            >
              <Plus className="mr-2 h-4 w-4" /> New Template
            </Button>
          </div>
          
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>All Templates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {templates.length} templates found
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => loadTemplates().catch(() => {})}>
                {loadingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No templates yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-2xl border border-stone-200 p-4 dark:border-stone-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold">{template.title}</h3>
                          <p className="text-sm text-muted-foreground">{template.subject}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/emails/templates/${template.id}`)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Versions: v{template.version} · Used {template.campaignCount}{" "}
                          {template.campaignCount === 1 ? "time" : "times"}
                        </span>
                        <span>Last used: {template.lastUsedAt ? formatDateTime(template.lastUsedAt) : "Never"}</span>
                        {template.variables?.length ? (
                          <span className="flex items-center gap-1">
                            Variables:
                            {template.variables.map((variable) => (
                              <Badge key={variable} variant="secondary">
                                {variable}
                              </Badge>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full max-w-xl">
          <SheetHeader>
            <SheetTitle>Schedule campaign</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-title">Campaign name</Label>
              <Input
                id="campaign-title"
                value={campaignForm.title}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Spring update"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-template">Template</Label>
              <Select
                id="campaign-template"
                value={campaignForm.templateId}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, templateId: event.target.value }))
                }
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-datetime">Send at</Label>
              <Input
                id="campaign-datetime"
                type="datetime-local"
                value={campaignForm.scheduledFor}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-timezone">Timezone</Label>
              <Input
                id="campaign-timezone"
                value={campaignForm.timezone}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, timezone: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-preview">Preview text override</Label>
              <Input
                id="campaign-preview"
                value={campaignForm.previewText}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, previewText: event.target.value }))
                }
                placeholder="Optional preview text"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign-description">Notes (optional)</Label>
              <Textarea
                id="campaign-description"
                value={campaignForm.description}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
            <Button onClick={handleCreateCampaign} disabled={campaignSaving}>
              {campaignSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Schedule
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
