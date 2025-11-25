import React from "react"
import "./AdminEmailsPanel.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Plus,
  Send,
  Trash2,
  Play,
  Square,
  Loader2,
  Mail,
  FileText,
  Calendar,
  Users,
  ChevronRight,
  Sparkles,
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
    return new Date(value).toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } catch {
    return value
  }
}

const formatRelativeTime = (value?: string | null) => {
  if (!value) return null
  try {
    const date = new Date(value)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffMs < 0) {
      const absDays = Math.abs(diffDays)
      if (absDays === 0) return "Today"
      if (absDays === 1) return "Yesterday"
      return `${absDays} days ago`
    }
    if (diffDays === 0) {
      if (diffHours <= 1) return "In less than an hour"
      return `In ${diffHours} hours`
    }
    if (diffDays === 1) return "Tomorrow"
    return `In ${diffDays} days`
  } catch {
    return null
  }
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "scheduled":
      return { label: "Scheduled", bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" }
    case "running":
      return { label: "Sending", bg: "bg-amber-500/10", text: "text-amber-600", dot: "bg-amber-500 animate-pulse" }
    case "sent":
      return { label: "Sent", bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "bg-emerald-500" }
    case "partial":
      return { label: "Partial", bg: "bg-purple-500/10", text: "text-purple-600", dot: "bg-purple-500" }
    case "failed":
      return { label: "Failed", bg: "bg-red-500/10", text: "text-red-600", dot: "bg-red-500" }
    case "cancelled":
      return { label: "Cancelled", bg: "bg-stone-500/10", text: "text-stone-500", dot: "bg-stone-400" }
    default:
      return { label: status, bg: "bg-stone-500/10", text: "text-stone-500", dot: "bg-stone-400" }
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
        ? `WARNING: This campaign "${campaign.title}" has already been sent to ${campaign.sentCount} users.\n\nAre you sure you want to delete it?`
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Email Center</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create templates and schedule campaigns to reach your users
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2">
          <Link
            to="/admin/emails"
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
              activeView === "campaigns"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <Send className="h-4 w-4" />
            Campaigns
            {campaigns.length > 0 && (
              <span className={cn(
                "ml-1 px-2 py-0.5 rounded-full text-xs",
                activeView === "campaigns" 
                  ? "bg-white/20 text-white" 
                  : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
              )}>
                {campaigns.length}
              </span>
            )}
          </Link>
          <Link
            to="/admin/emails/templates"
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
              activeView === "templates"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
            )}
          >
            <FileText className="h-4 w-4" />
            Templates
            {templates.length > 0 && (
              <span className={cn(
                "ml-1 px-2 py-0.5 rounded-full text-xs",
                activeView === "templates" 
                  ? "bg-white/20 text-white" 
                  : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
              )}>
                {templates.length}
              </span>
            )}
          </Link>

          <div className="flex-1" />

          {/* Action Buttons */}
          {activeView === "campaigns" && (
            <Button 
              onClick={() => setSheetOpen(true)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          )}
          {activeView === "templates" && (
            <Button 
              onClick={() => navigate("/admin/emails/templates/create")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Campaigns View */}
      {activeView === "campaigns" && (
        <div className="space-y-4">
          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading campaigns...</span>
              </div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No campaigns yet</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                Create your first campaign to start sending emails to your users.
              </p>
              <Button onClick={() => setSheetOpen(true)} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => {
                const statusConfig = getStatusConfig(campaign.status)
                const relativeTime = formatRelativeTime(campaign.scheduledFor)
                
                return (
                  <div
                    key={campaign.id}
                    className="group relative rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                        statusConfig.bg
                      )}>
                        <Send className={cn("h-5 w-5", statusConfig.text)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-stone-900 dark:text-white truncate">
                            {campaign.title}
                          </h3>
                          <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                            statusConfig.bg, statusConfig.text
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
                            {statusConfig.label}
                          </div>
                        </div>
                        
                        <p className="text-sm text-stone-500 dark:text-stone-400 truncate">
                          {campaign.templateTitle || "Template removed"} · {campaign.subject}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(campaign.scheduledFor)}
                            {relativeTime && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                ({relativeTime})
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {campaign.sentCount} / {campaign.totalRecipients} sent
                            {campaign.failedCount > 0 && (
                              <span className="text-red-500">({campaign.failedCount} failed)</span>
                            )}
                          </span>
                        </div>

                        {campaign.sendError && (
                          <p className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">
                            Error: {campaign.sendError}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRunCampaign(campaign)}
                          disabled={campaign.status === "running"}
                          className="rounded-lg h-9 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        >
                          <Play className="h-4 w-4 mr-1.5" />
                          Send
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleCancelCampaign(campaign)}
                          className="rounded-lg h-9 px-3 text-stone-500 hover:text-stone-700"
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCampaign(campaign)}
                          className="rounded-lg h-9 px-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Templates View */}
      {activeView === "templates" && (
        <div className="space-y-4">
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading templates...</span>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No templates yet</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                Create a template to define the look and content of your email campaigns.
              </p>
              <Button onClick={() => navigate("/admin/emails/templates/create")} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => navigate(`/admin/emails/templates/${template.id}`)}
                  className="group relative rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 cursor-pointer transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-0.5"
                >
                  {/* Preview gradient */}
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {template.subject}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-stone-300 dark:text-stone-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="mt-4 pt-4 border-t border-stone-100 dark:border-[#2a2a2d]">
                    <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                      <span>v{template.version}</span>
                      <span>Used {template.campaignCount}×</span>
                    </div>
                    
                    {template.variables?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {template.variables.slice(0, 3).map((variable) => (
                          <span 
                            key={variable} 
                            className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#2a2a2d] text-xs text-stone-600 dark:text-stone-400 font-mono"
                          >
                            {variable}
                          </span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="px-2 py-0.5 text-xs text-stone-400">
                            +{template.variables.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete button (stops propagation) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTemplate(template)
                    }}
                    className="absolute top-3 right-3 p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Campaign Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full max-w-lg border-l border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d]">
          <SheetHeader className="pb-6 border-b border-stone-100 dark:border-[#2a2a2d]">
            <SheetTitle className="text-xl font-bold">Create Campaign</SheetTitle>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Schedule an email to send to all users
            </p>
          </SheetHeader>
          
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="campaign-title" className="text-sm font-medium">Campaign Name</Label>
              <Input
                id="campaign-title"
                value={campaignForm.title}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="e.g., Spring Newsletter"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-template" className="text-sm font-medium">Email Template</Label>
              <Select
                id="campaign-template"
                value={campaignForm.templateId}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, templateId: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42]"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No templates available. Create one first.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-datetime" className="text-sm font-medium">Schedule For</Label>
              <Input
                id="campaign-datetime"
                type="datetime-local"
                value={campaignForm.scheduledFor}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-timezone" className="text-sm font-medium">Timezone</Label>
              <Input
                id="campaign-timezone"
                value={campaignForm.timezone}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, timezone: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-preview" className="text-sm font-medium">
                Preview Text <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="campaign-preview"
                value={campaignForm.previewText}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, previewText: event.target.value }))
                }
                placeholder="Short preview shown in inbox"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-description" className="text-sm font-medium">
                Internal Notes <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="campaign-description"
                value={campaignForm.description}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Notes for your team..."
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] min-h-[80px]"
              />
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-stone-100 dark:border-[#2a2a2d] flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setSheetOpen(false)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCampaign} 
              disabled={campaignSaving}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              {campaignSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Schedule Campaign
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
