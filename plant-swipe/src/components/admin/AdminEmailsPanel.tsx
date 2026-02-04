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
  Search,
  X,
  Copy,
  Zap,
} from "lucide-react"
import type { JSONContent } from "@tiptap/core"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/components/ui/search-input"
import { supabase } from "@/lib/supabaseClient"
import { useLocation } from "react-router-dom"
import { Link } from "@/components/i18n/Link"
import { useLanguageNavigate } from "@/lib/i18nRouting"

// =============================================================================
// TRIGGER VARIABLE CATALOG - Variables available for each trigger type
// Templates MUST use these exact variable names for proper substitution
// =============================================================================
const TRIGGER_VARIABLES: Record<string, { 
  variables: { token: string; description: string; required?: boolean }[]
  category: 'general' | 'security' | 'marketing'
}> = {
  // General/Marketing triggers
  WELCOME_EMAIL: {
    category: 'general',
    variables: [
      { token: '{{user}}', description: "User's display name (capitalized)", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{url}}', description: 'Website URL (aphylia.app)' },
      { token: '{{random}}', description: '10 random alphanumeric characters' },
    ]
  },
  BAN_USER: {
    category: 'general',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
  // Security triggers - Email Change
  EMAIL_CHANGE_NOTIFICATION: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{old_email}}', description: 'The previous email address (recipient)', required: true },
      { token: '{{new_email}}', description: 'The new email address', required: true },
      { token: '{{time}}', description: 'When the change occurred (UTC)' },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
  // Security triggers - Password
  PASSWORD_RESET_REQUEST: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{url}}', description: 'Secure password reset link', required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{time}}', description: 'When the request was made (UTC)' },
    ]
  },
  PASSWORD_CHANGE_CONFIRMATION: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{time}}', description: 'When the password was changed (UTC)', required: true },
      { token: '{{device}}', description: 'Device/browser used (e.g., Chrome on Windows)' },
      { token: '{{location}}', description: 'Geographic location (city, country)' },
      { token: '{{ip_address}}', description: 'IP address of the request' },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
  // Security triggers - Login
  SUSPICIOUS_LOGIN_ALERT: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{location}}', description: 'Login location (city, country)', required: true },
      { token: '{{device}}', description: 'Device/browser used', required: true },
      { token: '{{ip_address}}', description: 'IP address of the login' },
      { token: '{{time}}', description: 'When the login occurred (UTC)' },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
  NEW_DEVICE_LOGIN: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{device}}', description: 'New device/browser detected', required: true },
      { token: '{{location}}', description: 'Login location (city, country)' },
      { token: '{{ip_address}}', description: 'IP address of the login' },
      { token: '{{time}}', description: 'When the login occurred (UTC)' },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
  // Email Verification
  EMAIL_VERIFICATION: {
    category: 'security',
    variables: [
      { token: '{{user}}', description: "User's display name", required: true },
      { token: '{{email}}', description: "User's email address" },
      { token: '{{code}}', description: '6-character verification code (expires in 5 minutes)', required: true },
      { token: '{{url}}', description: 'Website URL' },
    ]
  },
}

// Get category badge color
const getCategoryConfig = (category: 'general' | 'security' | 'marketing') => {
  switch (category) {
    case 'security':
      return { label: 'Security', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: '🔐' }
    case 'marketing':
      return { label: 'Marketing', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: '📣' }
    default:
      return { label: 'General', bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-700 dark:text-stone-300', icon: '📧' }
  }
}

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
  testMode: boolean
  testEmail: string | null
  isMarketing: boolean // If true, only users with marketing_consent=true receive this
  createdAt: string
  updatedAt: string
}

type EmailTrigger = {
  id: string
  triggerType: string
  displayName: string
  description: string | null
  isEnabled: boolean
  templateId: string | null
  templateTitle?: string | null
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
  const globalEnv = globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } }
  const adminToken = globalEnv.__ENV__?.VITE_ADMIN_STATIC_TOKEN
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
  const navigate = useLanguageNavigate()
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
    testMode: false,
    testEmail: "dev@aphylia.app",
    isMarketing: false, // If true, only send to users with marketing_consent=true
  })
  const [campaignSaving, setCampaignSaving] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const location = useLocation()
  const activeView = location.pathname.includes("/templates") 
    ? "templates" 
    : location.pathname.includes("/automatic") 
      ? "automatic" 
      : "campaigns"
  const [loadingTemplates, setLoadingTemplates] = React.useState(false)
  const [templateSearch, setTemplateSearch] = React.useState("")
  
  // Automatic email triggers state
  const [triggers, setTriggers] = React.useState<EmailTrigger[]>([])
  const [loadingTriggers, setLoadingTriggers] = React.useState(false)
  const [savingTrigger, setSavingTrigger] = React.useState<string | null>(null)

  // Filter templates based on search query
  const filteredTemplates = React.useMemo(() => {
    if (!templateSearch.trim()) return templates
    const query = templateSearch.toLowerCase()
    return templates.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.subject.toLowerCase().includes(query)
    )
  }, [templates, templateSearch])

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

  const loadTriggers = React.useCallback(async () => {
    setLoadingTriggers(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch("/api/admin/email-triggers", { headers, credentials: "same-origin" })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || "Failed to load triggers")
      setTriggers(Array.isArray(data?.triggers) ? data.triggers : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTriggers(false)
    }
  }, [])

  React.useEffect(() => {
    if (activeView === "campaigns") loadCampaigns().catch(() => {})
    if (activeView === "templates") loadTemplates().catch(() => {})
    if (activeView === "automatic") {
      loadTriggers().catch(() => {})
      loadTemplates().catch(() => {}) // Load templates for the dropdown
    }
    loadTemplates().catch(() => {}) 
  }, [activeView, loadTemplates, loadCampaigns, loadTriggers])

  const handleUpdateTrigger = React.useCallback(
    async (trigger: EmailTrigger, updates: { isEnabled?: boolean; templateId?: string | null }) => {
      setSavingTrigger(trigger.id)
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-triggers/${encodeURIComponent(trigger.id)}`, {
          method: "PUT",
          headers,
          credentials: "same-origin",
          body: JSON.stringify(updates),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to update trigger")
        
        // Update local state
        setTriggers(prev => prev.map(t => 
          t.id === trigger.id 
            ? { 
                ...t, 
                ...updates,
                templateTitle: updates.templateId 
                  ? templates.find(tpl => tpl.id === updates.templateId)?.title || null
                  : updates.templateId === null ? null : t.templateTitle
              } 
            : t
        ))
      } catch (err) {
        alert((err as Error).message)
      } finally {
        setSavingTrigger(null)
      }
    },
    [templates],
  )

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
        testMode: campaignForm.testMode,
        testEmail: campaignForm.testMode ? campaignForm.testEmail.trim() : null,
        isMarketing: campaignForm.isMarketing, // Exclude users without marketing consent
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
        testMode: false,
        testEmail: "dev@aphylia.app",
        isMarketing: false,
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

  const handleDuplicateTemplate = React.useCallback(
    async (template: EmailTemplate) => {
      try {
        const headers = await buildAdminHeaders()
        const payload = {
          title: `${template.title}_copy`,
          subject: template.subject,
          previewText: template.previewText || "",
          description: template.description || "",
          bodyHtml: template.bodyHtml,
          bodyJson: template.bodyJson,
          isActive: template.isActive,
        }
        
        const resp = await fetch("/api/admin/email-templates", {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify(payload),
        })
        
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(data?.error || "Failed to duplicate template")
        
        loadTemplates().catch(() => {})
        alert(`Template duplicated as "${payload.title}"`)
      } catch (err) {
        alert((err as Error).message)
      }
    },
    [loadTemplates],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">Email Center</h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create templates and schedule campaigns to reach your users
          </p>
        </div>

        {/* Tab Navigation - Scrollable on mobile */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
            <Link
              to="/admin/emails"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === "campaigns"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Campaigns
              {campaigns.length > 0 && (
                <span className={cn(
                  "ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs",
                  activeView === "campaigns" 
                    ? "bg-white/20 text-white" 
                    : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                )}>
                  {campaigns.length}
                </span>
              )}
            </Link>
            <Link
              to="/admin/emails/automatic"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === "automatic"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Automatic
            </Link>
            <Link
              to="/admin/emails/templates"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === "templates"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Templates
              {templates.length > 0 && (
                <span className={cn(
                  "ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs",
                  activeView === "templates" 
                    ? "bg-white/20 text-white" 
                    : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                )}>
                  {templates.length}
                </span>
              )}
            </Link>
          </div>

          {/* Action Buttons - Full width on mobile */}
          {activeView === "campaigns" && (
            <Button 
              onClick={() => setSheetOpen(true)}
              className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 h-10 sm:h-11 text-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          )}
          {activeView === "templates" && (
            <Button 
              onClick={() => navigate("/admin/emails/templates/create")}
              className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 h-10 sm:h-11 text-sm"
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
            <div className="grid gap-3 sm:gap-4">
              {campaigns.map((campaign) => {
                const statusConfig = getStatusConfig(campaign.status)
                const relativeTime = formatRelativeTime(campaign.scheduledFor)
                
                return (
                  <div
                    key={campaign.id}
                    className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Header Row - Icon, Title, Badges */}
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center",
                          statusConfig.bg
                        )}>
                          <Send className={cn("h-4 w-4 sm:h-5 sm:w-5", statusConfig.text)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <h3 className="font-semibold text-stone-900 dark:text-white text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                              {campaign.title}
                            </h3>
                            {campaign.testMode && (
                              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                🧪 Test
                              </div>
                            )}
                            {campaign.isMarketing && (
                              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                📧 Marketing
                              </div>
                            )}
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium",
                              statusConfig.bg, statusConfig.text
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
                              {statusConfig.label}
                            </div>
                          </div>
                          
                          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                            {campaign.templateTitle || "Template removed"} · {campaign.subject}
                          </p>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          <span>{formatDateTime(campaign.scheduledFor)}</span>
                          {relativeTime && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              ({relativeTime})
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {campaign.testMode ? (
                            <span className="text-amber-600 dark:text-amber-400 truncate max-w-[200px]">
                              → {campaign.testEmail || "test email"}
                            </span>
                          ) : (
                            <>
                              {campaign.sentCount} / {campaign.totalRecipients} sent
                              {campaign.failedCount > 0 && (
                                <span className="text-red-500 ml-1">({campaign.failedCount} failed)</span>
                              )}
                            </>
                          )}
                        </span>
                      </div>

                      {campaign.sendError && (
                        <p className="text-[10px] sm:text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                          Error: {campaign.sendError}
                        </p>
                      )}

                      {/* Actions - Always visible on mobile, hover on desktop */}
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-2 border-t border-stone-100 dark:border-[#2a2a2d] sm:border-0 sm:pt-0 sm:absolute sm:top-4 sm:right-4 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRunCampaign(campaign)}
                          disabled={campaign.status === "running"}
                          className="rounded-lg h-8 sm:h-9 px-2 sm:px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs sm:text-sm"
                        >
                          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Send</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleCancelCampaign(campaign)}
                          className="rounded-lg h-8 sm:h-9 px-2 sm:px-3 text-stone-500 hover:text-stone-700 text-xs sm:text-sm"
                        >
                          <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCampaign(campaign)}
                          className="rounded-lg h-8 sm:h-9 px-2 sm:px-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs sm:text-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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

      {/* Automatic Emails View */}
      {activeView === "automatic" && (
        <div className="space-y-4">
          {loadingTriggers ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading automatic emails...</span>
              </div>
            </div>
          ) : triggers.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No automatic emails configured</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                Automatic emails will appear here once they are set up in the database.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>💡 How it works:</strong> When enabled, these emails are automatically sent when specific events occur (e.g., new user signup). 
                  Configure a template and enable the trigger to start sending. <strong>Your template MUST use the listed variables</strong> for proper personalization.
                </p>
              </div>
              
              <div className="grid gap-4">
                {triggers.map((trigger) => {
                  const triggerVars = TRIGGER_VARIABLES[trigger.triggerType]
                  const categoryConfig = triggerVars ? getCategoryConfig(triggerVars.category) : getCategoryConfig('general')
                  
                  return (
                  <div
                    key={trigger.id}
                    className={cn(
                      "rounded-xl sm:rounded-2xl border bg-white dark:bg-[#1e1e20] p-5 sm:p-6",
                      triggerVars?.category === 'security' 
                        ? "border-red-200 dark:border-red-900/50" 
                        : "border-stone-200 dark:border-[#3e3e42]"
                    )}
                  >
                    <div className="flex flex-col gap-4">
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        {/* Icon and Info */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className={cn(
                            "flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl",
                            trigger.isEnabled 
                              ? "bg-emerald-100 dark:bg-emerald-900/30" 
                              : "bg-stone-100 dark:bg-[#2a2a2d]"
                          )}>
                            {triggerVars?.category === 'security' ? '🔐' : <Zap className={cn(
                              "h-5 w-5 sm:h-6 sm:w-6",
                              trigger.isEnabled 
                                ? "text-emerald-600 dark:text-emerald-400" 
                                : "text-stone-400"
                            )} />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-stone-900 dark:text-white text-base sm:text-lg">
                                {trigger.displayName}
                              </h3>
                              {/* Category Badge */}
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                categoryConfig.bg, categoryConfig.text
                              )}>
                                {categoryConfig.icon} {categoryConfig.label}
                              </span>
                              {/* Status Badge */}
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                trigger.isEnabled
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-500"
                              )}>
                                {trigger.isEnabled ? "Active" : "Disabled"}
                              </span>
                            </div>
                            
                            {trigger.description && (
                              <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
                                {trigger.description}
                              </p>
                            )}
                            
                            <div className="text-xs text-stone-400 font-mono">
                              Trigger ID: <code className="bg-stone-100 dark:bg-[#2a2a2d] px-1.5 py-0.5 rounded">{trigger.triggerType}</code>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-3 sm:min-w-[280px]">
                          {/* Template Selection */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                              Email Template
                            </Label>
                            <Select
                              value={trigger.templateId || ""}
                              onChange={(e) => {
                                const newTemplateId = e.target.value || null
                                handleUpdateTrigger(trigger, { templateId: newTemplateId })
                              }}
                              disabled={savingTrigger === trigger.id}
                              className="w-full rounded-lg border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
                            >
                              <option value="">No template (disabled)</option>
                              {templates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.title} (v{tpl.version})
                                </option>
                              ))}
                            </Select>
                            {trigger.templateId && trigger.templateTitle && (
                              <p className="text-xs text-stone-500">
                                Using: <span className="font-medium">{trigger.templateTitle}</span>
                              </p>
                            )}
                            {!trigger.templateId && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ Select a template to enable this trigger
                              </p>
                            )}
                          </div>

                          {/* Enable/Disable Toggle */}
                          <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-[#2a2a2d]">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                              Send Automatically
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateTrigger(trigger, { isEnabled: !trigger.isEnabled })}
                              disabled={savingTrigger === trigger.id || !trigger.templateId}
                              className={cn(
                                "relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                trigger.isEnabled ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-600"
                              )}
                              title={!trigger.templateId ? "Select a template first" : trigger.isEnabled ? "Disable" : "Enable"}
                            >
                              {savingTrigger === trigger.id ? (
                                <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white" />
                              ) : (
                                <span
                                  className={cn(
                                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                                    trigger.isEnabled ? "left-6" : "left-1"
                                  )}
                                />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Variables Section - Highlighted */}
                      {triggerVars && triggerVars.variables.length > 0 && (
                        <div className={cn(
                          "rounded-xl p-4 border",
                          triggerVars.category === 'security'
                            ? "bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-900/30"
                            : "bg-purple-50/50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-900/30"
                        )}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                              📋 Required Template Variables
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                              Use these in your template
                            </span>
                          </div>
                          
                          <div className="grid gap-2 sm:grid-cols-2">
                            {triggerVars.variables.map((v) => (
                              <div 
                                key={v.token}
                                className={cn(
                                  "flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                                  v.required 
                                    ? "bg-white dark:bg-[#1e1e20] border border-amber-300 dark:border-amber-700"
                                    : "bg-white/50 dark:bg-[#1e1e20]/50 hover:bg-white dark:hover:bg-[#1e1e20]"
                                )}
                                onClick={() => {
                                  navigator.clipboard?.writeText(v.token)
                                }}
                                title="Click to copy"
                              >
                                <code className={cn(
                                  "px-2 py-0.5 rounded text-xs font-mono shrink-0",
                                  v.required
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold"
                                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                )}>
                                  {v.token}
                                </code>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-tight">
                                    {v.description}
                                  </p>
                                  {v.required && (
                                    <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                                      Required
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <p className="mt-3 text-[10px] text-stone-500 dark:text-stone-500">
                            💡 Click any variable to copy it. Yellow-bordered variables are <strong>required</strong> for this email type.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates View */}
      {activeView === "templates" && (
        <div className="space-y-3 sm:space-y-4">
          {/* Search Bar */}
          {templates.length > 0 && (
            <div className="relative">
              <SearchInput
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="h-10 sm:h-11 rounded-xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] text-sm"
              />
              {templateSearch && (
                <button
                  type="button"
                  onClick={() => setTemplateSearch("")}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-[#2a2a2d] transition-colors z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-12 sm:py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading templates...</span>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-8 sm:p-12 text-center">
              <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 sm:mb-4">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white mb-2">No templates yet</h3>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-4 sm:mb-6 max-w-sm mx-auto">
                Create a template to define the look and content of your email campaigns.
              </p>
              <Button onClick={() => navigate("/admin/emails/templates/create")} className="rounded-xl text-sm h-10">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-8 sm:p-12 text-center">
              <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-3 sm:mb-4">
                <Search className="h-5 w-5 sm:h-6 sm:w-6 text-stone-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white mb-2">No results found</h3>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-4">
                No templates match "<span className="font-medium">{templateSearch}</span>"
              </p>
              <Button variant="outline" onClick={() => setTemplateSearch("")} className="rounded-xl text-sm h-10">
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => navigate(`/admin/emails/templates/${template.id}`)}
                  className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 cursor-pointer transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-xl hover:shadow-emerald-500/10 sm:hover:-translate-y-0.5"
                >
                  {/* Preview gradient */}
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-900 dark:text-white text-sm sm:text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {template.subject}
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-stone-300 dark:text-stone-600 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stone-100 dark:border-[#2a2a2d]">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-stone-500 dark:text-stone-400">
                      <span>v{template.version}</span>
                      <span>Used {template.campaignCount}×</span>
                    </div>
                    
                    {template.variables?.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2 sm:mt-3">
                        {template.variables.slice(0, 3).map((variable) => (
                          <span 
                            key={variable} 
                            className="px-1.5 sm:px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#2a2a2d] text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 font-mono"
                          >
                            {variable}
                          </span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-stone-400">
                            +{template.variables.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons - Always visible on mobile, hover on desktop */}
                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-stone-100 dark:border-[#2a2a2d] sm:border-0 sm:mt-0 sm:pt-0 sm:absolute sm:top-3 sm:right-3 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicateTemplate(template)
                      }}
                      className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
                      title="Duplicate template"
                    >
                      <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(template)
                      }}
                      className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Campaign Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg border-l border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] overflow-y-auto">
          <SheetHeader className="pb-4 sm:pb-6 border-b border-stone-100 dark:border-[#2a2a2d]">
            <SheetTitle className="text-lg sm:text-xl font-bold">Create Campaign</SheetTitle>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              Schedule an email to send to all users
            </p>
          </SheetHeader>
          
          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-title" className="text-xs sm:text-sm font-medium">Campaign Name</Label>
              <Input
                id="campaign-title"
                value={campaignForm.title}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="e.g., Spring Newsletter"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-template" className="text-xs sm:text-sm font-medium">Email Template</Label>
              <Select
                id="campaign-template"
                value={campaignForm.templateId}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, templateId: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
              {templates.length === 0 && (
                <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">
                  No templates available. Create one first.
                </p>
              )}
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-datetime" className="text-xs sm:text-sm font-medium">Schedule For</Label>
              <Input
                id="campaign-datetime"
                type="datetime-local"
                value={campaignForm.scheduledFor}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-timezone" className="text-xs sm:text-sm font-medium">Timezone</Label>
              <Input
                id="campaign-timezone"
                value={campaignForm.timezone}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, timezone: event.target.value }))
                }
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-preview" className="text-xs sm:text-sm font-medium">
                Preview Text <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="campaign-preview"
                value={campaignForm.previewText}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, previewText: event.target.value }))
                }
                placeholder="Short preview shown in inbox"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-description" className="text-xs sm:text-sm font-medium">
                Internal Notes <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="campaign-description"
                value={campaignForm.description}
                onChange={(event) =>
                  setCampaignForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Notes for your team..."
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] min-h-[60px] sm:min-h-[80px] text-sm"
              />
            </div>

            {/* Marketing Email Toggle */}
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-300">
                    📧 Marketing Email
                  </Label>
                  <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                    Only send to users who opted-in to marketing communications
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignForm((prev) => ({ ...prev, isMarketing: !prev.isMarketing }))}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors flex-shrink-0",
                    campaignForm.isMarketing ? "bg-purple-500" : "bg-stone-300 dark:bg-stone-600"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                      campaignForm.isMarketing ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>
              {campaignForm.isMarketing && (
                <p className="text-[10px] sm:text-xs text-purple-700 dark:text-purple-300 mt-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg px-2 py-1.5">
                  ⚠️ Users who unchecked "Marketing Communications" in Settings will not receive this email.
                </p>
              )}
            </div>

            {/* Test Mode Toggle */}
            <div className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300">
                    🧪 Test Mode
                  </Label>
                  <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Send only to a test email instead of all users
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignForm((prev) => ({ ...prev, testMode: !prev.testMode }))}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors flex-shrink-0",
                    campaignForm.testMode ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                      campaignForm.testMode ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>
              
              {campaignForm.testMode && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="test-email" className="text-[10px] sm:text-xs font-medium text-amber-700 dark:text-amber-400">
                    Test Email Address
                  </Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={campaignForm.testEmail}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, testEmail: event.target.value }))
                    }
                    placeholder="dev@aphylia.app"
                    className="rounded-lg border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1a1a1d] text-sm h-10"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-stone-100 dark:border-[#2a2a2d] flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => setSheetOpen(false)}
              className="w-full sm:flex-1 rounded-xl h-10 text-sm order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCampaign} 
              disabled={campaignSaving}
              className={cn(
                "w-full sm:flex-1 rounded-xl h-10 text-sm order-1 sm:order-2",
                campaignForm.testMode 
                  ? "bg-amber-500 hover:bg-amber-600" 
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {campaignSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {campaignForm.testMode ? "Schedule Test" : "Schedule Campaign"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
