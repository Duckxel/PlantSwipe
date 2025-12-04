import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { supabase } from '@/lib/supabaseClient'
import {
  BellRing,
  Pause,
  Play,
  Trash2,
  Edit,
  Plus,
  Clock,
  Send,
  Users,
  Calendar,
  MessageSquare,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Zap,
  Info,
  X,
  Search,
  Loader2,
  Target,
  FileText,
  Copy,
  ChevronRight,
  Globe,
  Languages,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { Link, useLocation } from 'react-router-dom'
import { translateNotificationToAllLanguages } from '@/lib/deepl'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@/lib/i18n'

// Types
type NotificationTemplate = {
  id: string
  title: string
  description: string | null
  messageVariants: string[]
  randomize: boolean
  isActive: boolean
  usageCount: number
  campaignCount: number
  automationCount: number
  createdAt: string
  updatedAt: string
  translations?: Record<string, string[]>
}

type TranslationLanguage = {
  code: string
  label: string
}

type NotificationCampaign = {
  id: string
  title: string
  description: string | null
  audience: string
  deliveryMode: string
  state: string
  templateId: string | null
  templateTitle: string | null
  messageVariants: string[]
  randomize: boolean
  timezone: string | null
  plannedFor: string | null
  scheduleStartAt: string | null
  scheduleInterval: string | null
  ctaUrl: string | null
  customUserIds: string[]
  runCount: number
  nextRunAt: string | null
  lastRunAt: string | null
  estimatedRecipients: number
  stats: { total: number; sent: number; pending: number; failed: number }
}

type NotificationAutomation = {
  id: string
  triggerType: string
  displayName: string
  description: string | null
  isEnabled: boolean
  templateId: string | null
  templateTitle: string | null
  sendHour: number
  ctaUrl: string | null
  lastRunAt: string | null
  lastRunSummary: any
  recipientCount: number
  createdAt: string
  updatedAt: string
}

// Constants
const deliveryModeOptions = [
  { value: 'send_now', label: 'Send Instantly', description: 'All users receive immediately', icon: Zap, color: 'purple' },
  { value: 'planned', label: 'Planned', description: 'One-time, scheduled for a specific date', icon: Calendar, color: 'indigo' },
] as const

const audienceOptions = [
  { value: 'all', label: 'All Users', icon: Users },
  { value: 'tasks_open', label: 'Incomplete Tasks Today', icon: CheckCircle2 },
  { value: 'inactive_week', label: 'Inactive 7+ Days', icon: AlertCircle },
  { value: 'admins', label: 'Admins Only', icon: Users },
  { value: 'custom', label: 'Custom User IDs', icon: Users },
] as const

const audienceLabels: Record<string, string> = audienceOptions.reduce((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {} as Record<string, string>)

const TEMPLATE_VARIABLES = [
  { variable: '{{user}}', description: 'User display name' },
]

// Helpers
async function buildAdminHeaders() {
  const session = (await supabase.auth.getSession()).data.session
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  const adminToken = (globalThis as any)?.__ENV__?.VITE_ADMIN_STATIC_TOKEN
  if (adminToken) headers['X-Admin-Token'] = adminToken
  return headers
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function formatRelativeTime(value?: string | null): string | null {
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

const getStatusConfig = (state: string) => {
  switch (state) {
    case 'scheduled':
      return { label: 'Scheduled', bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' }
    case 'paused':
      return { label: 'Paused', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' }
    case 'completed':
      return { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' }
    case 'processing':
      return { label: 'Processing...', bg: 'bg-purple-500/10', text: 'text-purple-600', dot: 'bg-purple-500 animate-pulse' }
    case 'draft':
      return { label: 'Draft', bg: 'bg-stone-500/10', text: 'text-stone-500', dot: 'bg-stone-400' }
    default:
      return { label: state, bg: 'bg-stone-500/10', text: 'text-stone-500', dot: 'bg-stone-400' }
  }
}

const getDeliveryConfig = (mode: string) => {
  switch (mode) {
    case 'send_now':
      return { label: 'Instant', bg: 'bg-purple-500/10', text: 'text-purple-600', Icon: Zap }
    case 'planned':
      return { label: 'Planned', bg: 'bg-indigo-500/10', text: 'text-indigo-600', Icon: Calendar }
    case 'scheduled':
      return { label: 'Scheduled', bg: 'bg-emerald-500/10', text: 'text-emerald-600', Icon: Clock }
    default:
      return { label: mode, bg: 'bg-stone-500/10', text: 'text-stone-500', Icon: Clock }
  }
}

const DEFAULT_TIMEZONE = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'

// =========================================================================
// Main Component
// =========================================================================
export function AdminNotificationsPanel() {
  const location = useLocation()
  const activeView = location.pathname.includes('/templates')
    ? 'templates'
    : location.pathname.includes('/automations')
      ? 'automations'
      : 'campaigns'

  // State: Campaigns
  const [campaigns, setCampaigns] = React.useState<NotificationCampaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = React.useState(false)
  const [campaignSearch, setCampaignSearch] = React.useState('')

  // State: Templates
  const [templates, setTemplates] = React.useState<NotificationTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = React.useState(false)
  const [templateSearch, setTemplateSearch] = React.useState('')

  // State: Automations
  const [automations, setAutomations] = React.useState<NotificationAutomation[]>([])
  const [loadingAutomations, setLoadingAutomations] = React.useState(false)
  const [savingAutomation, setSavingAutomation] = React.useState<string | null>(null)

  // State: Push Config
  const [pushConfigured, setPushConfigured] = React.useState(true)

  // State: Campaign Form (Sheet)
  const [campaignSheetOpen, setCampaignSheetOpen] = React.useState(false)
  const [campaignForm, setCampaignForm] = React.useState({
    title: '',
    description: '',
    deliveryMode: 'send_now' as 'send_now' | 'planned',
    audience: 'all' as string,
    templateId: '',
    plannedFor: '',
    timezone: DEFAULT_TIMEZONE,
    ctaUrl: '',
    customUserIds: '',
  })
  const [campaignSaving, setCampaignSaving] = React.useState(false)

  // State: Template Form (Sheet)
  const [templateSheetOpen, setTemplateSheetOpen] = React.useState(false)
  const [templateEditId, setTemplateEditId] = React.useState<string | null>(null)
  const [templateForm, setTemplateForm] = React.useState({
    title: '',
    description: '',
    messageVariants: [] as string[],
    randomize: true,
    isActive: true,
  })
  const [templateSaving, setTemplateSaving] = React.useState(false)
  const [newVariantText, setNewVariantText] = React.useState('')
  const [showTemplateInfo, setShowTemplateInfo] = React.useState(false)

  // State: Translations
  const [languages, setLanguages] = React.useState<TranslationLanguage[]>([])
  const [selectedTranslationLang, setSelectedTranslationLang] = React.useState<string | null>(null)
  const [templateTranslations, setTemplateTranslations] = React.useState<Record<string, string[]>>({})
  const [newTranslationVariantText, setNewTranslationVariantText] = React.useState('')
  const [isAutoTranslating, setIsAutoTranslating] = React.useState(false)

  // Filtered lists
  const filteredCampaigns = React.useMemo(() => {
    if (!campaignSearch.trim()) return campaigns
    const query = campaignSearch.toLowerCase()
    return campaigns.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.messageVariants.some(m => m.toLowerCase().includes(query))
    )
  }, [campaigns, campaignSearch])

  const filteredTemplates = React.useMemo(() => {
    if (!templateSearch.trim()) return templates
    const query = templateSearch.toLowerCase()
    return templates.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.messageVariants.some(m => m.toLowerCase().includes(query))
    )
  }, [templates, templateSearch])

  // =========================================================================
  // Data Loading
  // =========================================================================
  const loadCampaigns = React.useCallback(async () => {
    setLoadingCampaigns(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch('/api/admin/notifications', { headers, credentials: 'same-origin' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to load campaigns')
      setCampaigns(Array.isArray(data?.notifications) ? data.notifications : [])
      setPushConfigured(Boolean(data?.pushConfigured ?? true))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCampaigns(false)
    }
  }, [])

  const loadTemplates = React.useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch('/api/admin/notification-templates', { headers, credentials: 'same-origin' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to load templates')
      setTemplates(Array.isArray(data?.templates) ? data.templates : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  const loadAutomations = React.useCallback(async () => {
    setLoadingAutomations(true)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch('/api/admin/notification-automations', { headers, credentials: 'same-origin' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to load automations')
      setAutomations(Array.isArray(data?.automations) ? data.automations : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAutomations(false)
    }
  }, [])

  const loadLanguages = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('translation_languages')
        .select('code, label')
        .order('code')
      if (error) throw error
      setLanguages(data || [])
    } catch (err) {
      console.error('Failed to load languages:', err)
    }
  }, [])

  React.useEffect(() => {
    loadLanguages().catch(() => {})
  }, [loadLanguages])

  React.useEffect(() => {
    if (activeView === 'campaigns') {
      loadCampaigns().catch(() => {})
      loadTemplates().catch(() => {}) // For template dropdown
    }
    if (activeView === 'templates') loadTemplates().catch(() => {})
    if (activeView === 'automations') {
      loadAutomations().catch(() => {})
      loadTemplates().catch(() => {}) // For template dropdown
    }
  }, [activeView, loadCampaigns, loadTemplates, loadAutomations])

  // =========================================================================
  // Campaign Actions
  // =========================================================================
  const handleCreateCampaign = React.useCallback(async () => {
    if (!campaignForm.title.trim()) {
      alert('Campaign title is required.')
      return
    }

    // Get message variants from selected template or require template
    const selectedTemplate = templates.find(t => t.id === campaignForm.templateId)
    if (!selectedTemplate) {
      alert('Please select a template.')
      return
    }

    setCampaignSaving(true)
    try {
      const headers = await buildAdminHeaders()
      const payload = {
        title: campaignForm.title.trim(),
        description: campaignForm.description.trim() || null,
        deliveryMode: campaignForm.deliveryMode,
        audience: campaignForm.audience,
        templateId: campaignForm.templateId,
        messageVariants: selectedTemplate.messageVariants,
        randomize: selectedTemplate.randomize,
        plannedFor: campaignForm.deliveryMode === 'planned' ? campaignForm.plannedFor : null,
        timezone: campaignForm.timezone || DEFAULT_TIMEZONE,
        ctaUrl: campaignForm.ctaUrl.trim() || null,
        customUserIds: campaignForm.audience === 'custom'
          ? campaignForm.customUserIds.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0)
          : [],
      }
      const resp = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to create campaign')
      setCampaignForm({
        title: '',
        description: '',
        deliveryMode: 'send_now',
        audience: 'all',
        templateId: '',
        plannedFor: '',
        timezone: DEFAULT_TIMEZONE,
        ctaUrl: '',
        customUserIds: '',
      })
      setCampaignSheetOpen(false)
      loadCampaigns().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setCampaignSaving(false)
    }
  }, [campaignForm, templates, loadCampaigns])

  const handleTriggerCampaign = React.useCallback(async (campaign: NotificationCampaign) => {
    if (!window.confirm(`Send campaign "${campaign.title}" now?`)) return
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch(`/api/admin/notifications/${encodeURIComponent(campaign.id)}/trigger`, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to trigger campaign')
      loadCampaigns().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    }
  }, [loadCampaigns])

  const handleDeleteCampaign = React.useCallback(async (campaign: NotificationCampaign) => {
    if (!window.confirm(`Delete campaign "${campaign.title}"?`)) return
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch(`/api/admin/notifications/${encodeURIComponent(campaign.id)}`, {
        method: 'DELETE',
        headers,
        credentials: 'same-origin',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to delete campaign')
      loadCampaigns().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    }
  }, [loadCampaigns])

  // =========================================================================
  // Template Actions
  // =========================================================================
  const openTemplateCreate = React.useCallback(() => {
    setTemplateEditId(null)
    setTemplateForm({ title: '', description: '', messageVariants: [], randomize: true, isActive: true })
    setNewVariantText('')
    setTemplateTranslations({})
    setSelectedTranslationLang(null)
    setNewTranslationVariantText('')
    setIsAutoTranslating(false)
    setTemplateSheetOpen(true)
  }, [])

  const openTemplateEdit = React.useCallback((template: NotificationTemplate) => {
    setTemplateEditId(template.id)
    setTemplateForm({
      title: template.title,
      description: template.description || '',
      messageVariants: [...template.messageVariants],
      randomize: template.randomize,
      isActive: template.isActive,
    })
    setNewVariantText('')
    // Load translations from template
    setTemplateTranslations(template.translations || {})
    setSelectedTranslationLang(null)
    setNewTranslationVariantText('')
    setIsAutoTranslating(false)
    setTemplateSheetOpen(true)
  }, [])

  const addMessageVariant = React.useCallback(() => {
    const text = newVariantText.trim()
    if (!text) return
    setTemplateForm(prev => ({ ...prev, messageVariants: [...prev.messageVariants, text] }))
    setNewVariantText('')
  }, [newVariantText])

  const removeMessageVariant = React.useCallback((index: number) => {
    setTemplateForm(prev => ({
      ...prev,
      messageVariants: prev.messageVariants.filter((_, i) => i !== index),
    }))
  }, [])

  // Translation variant helpers
  const addTranslationVariant = React.useCallback(() => {
    const text = newTranslationVariantText.trim()
    if (!text || !selectedTranslationLang) return
    setTemplateTranslations(prev => ({
      ...prev,
      [selectedTranslationLang]: [...(prev[selectedTranslationLang] || []), text],
    }))
    setNewTranslationVariantText('')
  }, [newTranslationVariantText, selectedTranslationLang])

  const removeTranslationVariant = React.useCallback((lang: string, index: number) => {
    setTemplateTranslations(prev => ({
      ...prev,
      [lang]: (prev[lang] || []).filter((_, i) => i !== index),
    }))
  }, [])

  const copyDefaultToTranslation = React.useCallback(() => {
    if (!selectedTranslationLang) return
    setTemplateTranslations(prev => ({
      ...prev,
      [selectedTranslationLang]: [...templateForm.messageVariants],
    }))
  }, [selectedTranslationLang, templateForm.messageVariants])

  // Auto-translate all variants to all languages using DeepL
  const handleAutoTranslate = React.useCallback(async () => {
    if (!templateForm.messageVariants.length) {
      alert('Add at least one message variant first.')
      return
    }
    if (isAutoTranslating) return

    setIsAutoTranslating(true)
    try {
      const translations = await translateNotificationToAllLanguages(
        templateForm.messageVariants,
        DEFAULT_LANGUAGE
      )

      // Update state with all translations (except English)
      const newTranslations: Record<string, string[]> = {}
      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang !== DEFAULT_LANGUAGE && translations[lang]) {
          newTranslations[lang] = translations[lang]
        }
      }
      setTemplateTranslations(newTranslations)
    } catch (err) {
      console.error('Auto-translate failed:', err)
      alert('Translation failed. Please try again.')
    } finally {
      setIsAutoTranslating(false)
    }
  }, [templateForm.messageVariants, isAutoTranslating])

  // Get non-English languages for translations
  const translationLanguages = React.useMemo(() => {
    return languages.filter(lang => lang.code !== 'en')
  }, [languages])

  const handleSaveTemplate = React.useCallback(async () => {
    if (!templateForm.title.trim()) {
      alert('Template title is required.')
      return
    }
    if (!templateForm.messageVariants.length) {
      alert('Add at least one message variant.')
      return
    }
    setTemplateSaving(true)
    try {
      const headers = await buildAdminHeaders()
      const payload = {
        title: templateForm.title.trim(),
        description: templateForm.description.trim() || null,
        messageVariants: templateForm.messageVariants,
        randomize: templateForm.randomize,
        isActive: templateForm.isActive,
      }
      const endpoint = templateEditId
        ? `/api/admin/notification-templates/${encodeURIComponent(templateEditId)}`
        : '/api/admin/notification-templates'
      const method = templateEditId ? 'PUT' : 'POST'
      const resp = await fetch(endpoint, {
        method,
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to save template')
      
      // Save translations if we have a template ID
      const savedTemplateId = data?.template?.id || templateEditId
      if (savedTemplateId && Object.keys(templateTranslations).length > 0) {
        try {
          await fetch(`/api/admin/notification-templates/${encodeURIComponent(savedTemplateId)}/translations`, {
            method: 'PUT',
            headers,
            credentials: 'same-origin',
            body: JSON.stringify({ translations: templateTranslations }),
          })
        } catch (translationErr) {
          console.error('Failed to save translations:', translationErr)
        }
      }
      
      setTemplateSheetOpen(false)
      setTemplateEditId(null)
      setTemplateTranslations({})
      loadTemplates().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setTemplateSaving(false)
    }
  }, [templateForm, templateEditId, templateTranslations, loadTemplates])

  const handleDeleteTemplate = React.useCallback(async (template: NotificationTemplate) => {
    if (!window.confirm(`Delete template "${template.title}"?`)) return
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch(`/api/admin/notification-templates/${encodeURIComponent(template.id)}`, {
        method: 'DELETE',
        headers,
        credentials: 'same-origin',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to delete template')
      loadTemplates().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    }
  }, [loadTemplates])

  const handleDuplicateTemplate = React.useCallback(async (template: NotificationTemplate) => {
    try {
      const headers = await buildAdminHeaders()
      const payload = {
        title: `${template.title}_copy`,
        description: template.description,
        messageVariants: template.messageVariants,
        randomize: template.randomize,
        isActive: template.isActive,
      }
      const resp = await fetch('/api/admin/notification-templates', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to duplicate template')
      loadTemplates().catch(() => {})
      alert(`Template duplicated as "${payload.title}"`)
    } catch (err) {
      alert((err as Error).message)
    }
  }, [loadTemplates])

  // =========================================================================
  // Automation Actions
  // =========================================================================
  const handleUpdateAutomation = React.useCallback(async (
    automation: NotificationAutomation,
    updates: { isEnabled?: boolean; templateId?: string | null; sendHour?: number; ctaUrl?: string | null }
  ) => {
    setSavingAutomation(automation.id)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch(`/api/admin/notification-automations/${encodeURIComponent(automation.id)}`, {
        method: 'PUT',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(updates),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to update automation')
      // Update local state
      setAutomations(prev => prev.map(a =>
        a.id === automation.id
          ? {
              ...a,
              ...updates,
              templateTitle: updates.templateId
                ? templates.find(t => t.id === updates.templateId)?.title || null
                : updates.templateId === null ? null : a.templateTitle
            }
          : a
      ))
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSavingAutomation(null)
    }
  }, [templates])

  const handleTriggerAutomation = React.useCallback(async (automation: NotificationAutomation) => {
    if (!window.confirm(`Manually trigger "${automation.displayName}" now?`)) return
    setSavingAutomation(automation.id)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch(`/api/admin/notification-automations/${encodeURIComponent(automation.id)}/trigger`, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to trigger automation')
      alert(`Automation triggered! ${data.result?.queued || 0} notifications queued.`)
      loadAutomations().catch(() => {})
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSavingAutomation(null)
    }
  }, [loadAutomations])

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <BellRing className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            Push Notifications
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1.5 sm:mt-2">
            Create templates, schedule campaigns, and manage automations
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
            <Link
              to="/admin/notifications"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === 'campaigns'
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Campaigns
              {campaigns.length > 0 && (
                <span className={cn(
                  "ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs",
                  activeView === 'campaigns'
                    ? "bg-white/20 text-white"
                    : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                )}>
                  {campaigns.length}
                </span>
              )}
            </Link>
            <Link
              to="/admin/notifications/automations"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === 'automations'
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Automations
            </Link>
            <Link
              to="/admin/notifications/templates"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                activeView === 'templates'
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-500/25"
                  : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
              )}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Templates
              {templates.length > 0 && (
                <span className={cn(
                  "ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs",
                  activeView === 'templates'
                    ? "bg-white/20 text-white"
                    : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                )}>
                  {templates.length}
                </span>
              )}
            </Link>
          </div>

          {/* Action Buttons */}
          {activeView === 'campaigns' && (
            <Button
              onClick={() => setCampaignSheetOpen(true)}
              className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20 h-10 sm:h-11 text-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          )}
          {activeView === 'templates' && (
            <Button
              onClick={openTemplateCreate}
              className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20 h-10 sm:h-11 text-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Push Configuration Warning */}
      {!pushConfigured && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Push delivery disabled</h3>
              <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
                Add VAPID keys to enable live notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============= CAMPAIGNS VIEW ============= */}
      {activeView === 'campaigns' && (
        <div className="space-y-4">
          {/* Search */}
          {campaigns.length > 0 && (
            <div className="relative w-full sm:max-w-md">
              <SearchInput
                placeholder="Search campaigns..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="h-10 sm:h-11 rounded-xl border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] text-sm"
              />
              {campaignSearch && (
                <button
                  type="button"
                  onClick={() => setCampaignSearch('')}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-[#2a2a2d] z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading campaigns...</span>
              </div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Send className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No campaigns yet</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm mx-auto">
                Create your first campaign to start sending push notifications.
              </p>
              <Button onClick={() => setCampaignSheetOpen(true)} className="rounded-xl bg-amber-600 hover:bg-amber-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-stone-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No results found</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                No campaigns match "<span className="font-medium">{campaignSearch}</span>"
              </p>
              <Button variant="outline" onClick={() => setCampaignSearch('')} className="rounded-xl">
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {filteredCampaigns.map((campaign) => {
                const statusConfig = getStatusConfig(campaign.state)
                const deliveryConfig = getDeliveryConfig(campaign.deliveryMode)
                const DeliveryIcon = deliveryConfig.Icon
                const relativeTime = formatRelativeTime(campaign.nextRunAt)

                return (
                  <div
                    key={campaign.id}
                    className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-lg hover:shadow-amber-500/5"
                  >
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Header Row */}
                      <div className="flex items-start gap-3">
                        <div className={cn("flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center", deliveryConfig.bg)}>
                          <DeliveryIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", deliveryConfig.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <h3 className="font-semibold text-stone-900 dark:text-white text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                              {campaign.title}
                            </h3>
                            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium", statusConfig.bg, statusConfig.text)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
                              {statusConfig.label}
                            </div>
                            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium", deliveryConfig.bg, deliveryConfig.text)}>
                              {deliveryConfig.label}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                            {campaign.templateTitle || 'No template'} · {audienceLabels[campaign.audience] || campaign.audience}
                          </p>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {campaign.estimatedRecipients.toLocaleString()} recipients
                          </span>
                        </span>
                        {campaign.nextRunAt && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span>{formatDateTime(campaign.nextRunAt)}</span>
                            {relativeTime && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                ({relativeTime})
                              </span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {campaign.stats.sent} sent
                          {campaign.stats.failed > 0 && (
                            <span className="text-red-500 ml-1">({campaign.stats.failed} failed)</span>
                          )}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-2 border-t border-stone-100 dark:border-[#2a2a2d] sm:border-0 sm:pt-0 sm:absolute sm:top-4 sm:right-4 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTriggerCampaign(campaign)}
                          className="rounded-lg h-8 sm:h-9 px-2 sm:px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs sm:text-sm"
                        >
                          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Send Now</span>
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

      {/* ============= AUTOMATIONS VIEW ============= */}
      {activeView === 'automations' && (
        <div className="space-y-4">
          {loadingAutomations ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading automations...</span>
              </div>
            </div>
          ) : automations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-[#3e3e42] p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No automations configured</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                Automations will appear here once they are set up in the database.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>💡 How it works:</strong> Automations run every hour and send notifications to users whose local time matches the configured send hour.
                  Configure a template and enable the trigger to start sending.
                </p>
              </div>

              <div className="grid gap-4">
                {automations.map((automation) => (
                  <div
                    key={automation.id}
                    className="rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 sm:p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Icon and Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          "flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center",
                          automation.isEnabled
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-stone-100 dark:bg-[#2a2a2d]"
                        )}>
                          <Zap className={cn(
                            "h-5 w-5 sm:h-6 sm:w-6",
                            automation.isEnabled
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-stone-400"
                          )} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-stone-900 dark:text-white text-base sm:text-lg">
                              {automation.displayName}
                            </h3>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              automation.isEnabled
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-500"
                            )}>
                              {automation.isEnabled ? "Active" : "Disabled"}
                            </span>
                          </div>

                          {automation.description && (
                            <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                              {automation.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                ~{automation.recipientCount.toLocaleString()} recipients
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Sends at {automation.sendHour}:00 (user's local time)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-3 sm:min-w-[280px]">
                        {/* Template Selection */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                            Notification Template
                          </Label>
                          <Select
                            value={automation.templateId || ""}
                            onChange={(e) => {
                              const newTemplateId = e.target.value || null
                              handleUpdateAutomation(automation, { templateId: newTemplateId })
                            }}
                            disabled={savingAutomation === automation.id}
                            className="w-full rounded-lg border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
                          >
                            <option value="">No template (disabled)</option>
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.title} ({tpl.messageVariants.length} variants)
                              </option>
                            ))}
                          </Select>
                          {automation.templateId && automation.templateTitle && (
                            <p className="text-xs text-stone-500">
                              Using: <span className="font-medium">{automation.templateTitle}</span>
                            </p>
                          )}
                          {!automation.templateId && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              ⚠️ Select a template to enable this automation
                            </p>
                          )}
                        </div>

                        {/* Send Hour */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                            Send Hour (User's Local Time)
                          </Label>
                          <Select
                            value={String(automation.sendHour)}
                            onChange={(e) => {
                              handleUpdateAutomation(automation, { sendHour: parseInt(e.target.value) })
                            }}
                            disabled={savingAutomation === automation.id}
                            className="w-full rounded-lg border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {i.toString().padStart(2, '0')}:00
                              </option>
                            ))}
                          </Select>
                        </div>

                        {/* Enable/Disable Toggle + Trigger */}
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-[#2a2a2d]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                              Send Automatically
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateAutomation(automation, { isEnabled: !automation.isEnabled })}
                              disabled={savingAutomation === automation.id || !automation.templateId}
                              className={cn(
                                "relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                automation.isEnabled ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
                              )}
                              title={!automation.templateId ? "Select a template first" : automation.isEnabled ? "Disable" : "Enable"}
                            >
                              {savingAutomation === automation.id ? (
                                <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white" />
                              ) : (
                                <span
                                  className={cn(
                                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                                    automation.isEnabled ? "left-6" : "left-1"
                                  )}
                                />
                              )}
                            </button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTriggerAutomation(automation)}
                            disabled={savingAutomation === automation.id || !automation.templateId}
                            className="rounded-lg h-8 text-xs"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Test Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============= TEMPLATES VIEW ============= */}
      {activeView === 'templates' && (
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
                  onClick={() => setTemplateSearch('')}
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
              <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3 sm:mb-4">
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-white mb-2">No templates yet</h3>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-4 sm:mb-6 max-w-sm mx-auto">
                Create a template to define message variations for your campaigns and automations.
              </p>
              <Button onClick={openTemplateCreate} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-sm h-10">
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
              <Button variant="outline" onClick={() => setTemplateSearch('')} className="rounded-xl text-sm h-10">
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => openTemplateEdit(template)}
                  className="group relative rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-4 sm:p-5 cursor-pointer transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-xl hover:shadow-amber-500/10 sm:hover:-translate-y-0.5"
                >
                  {/* Preview gradient */}
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-900 dark:text-white text-sm sm:text-base truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {template.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                          {template.messageVariants.length} variant{template.messageVariants.length !== 1 ? 's' : ''}
                        </p>
                        {template.translations && Object.keys(template.translations).length > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">
                            <Globe className="h-3 w-3" />
                            {Object.keys(template.translations).length} lang{Object.keys(template.translations).length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-stone-300 dark:text-stone-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stone-100 dark:border-[#2a2a2d]">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-stone-500 dark:text-stone-400">
                      <span className={template.isActive ? "text-amber-600" : "text-stone-400"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </span>
                      <span>Used in {template.campaignCount} campaign{template.campaignCount !== 1 ? 's' : ''}</span>
                    </div>

                    {template.messageVariants?.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2 sm:mt-3">
                        {template.messageVariants.slice(0, 2).map((variant, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 sm:px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#2a2a2d] text-[10px] sm:text-xs text-stone-600 dark:text-stone-400 truncate max-w-[120px]"
                          >
                            {variant}
                          </span>
                        ))}
                        {template.messageVariants.length > 2 && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs text-stone-400">
                            +{template.messageVariants.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
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

      {/* ============= CAMPAIGN SHEET ============= */}
      <Sheet open={campaignSheetOpen} onOpenChange={setCampaignSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg border-l border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] overflow-y-auto">
          <SheetHeader className="pb-4 sm:pb-6 border-b border-stone-100 dark:border-[#2a2a2d]">
            <SheetTitle className="text-lg sm:text-xl font-bold">Create Campaign</SheetTitle>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              Schedule a push notification to send to your users
            </p>
          </SheetHeader>

          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-title" className="text-xs sm:text-sm font-medium">Campaign Name</Label>
              <Input
                id="campaign-title"
                value={campaignForm.title}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Weekly Update"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-template" className="text-xs sm:text-sm font-medium">Message Template</Label>
              <Select
                id="campaign-template"
                value={campaignForm.templateId}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, templateId: e.target.value }))}
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title} ({template.messageVariants.length} variants)
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
              <Label htmlFor="campaign-delivery" className="text-xs sm:text-sm font-medium">Delivery Mode</Label>
              <Select
                id="campaign-delivery"
                value={campaignForm.deliveryMode}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, deliveryMode: e.target.value as 'send_now' | 'planned' }))}
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              >
                {deliveryModeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label} - {opt.description}</option>
                ))}
              </Select>
            </div>

            {campaignForm.deliveryMode === 'planned' && (
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="campaign-datetime" className="text-xs sm:text-sm font-medium">Schedule For</Label>
                <Input
                  id="campaign-datetime"
                  type="datetime-local"
                  value={campaignForm.plannedFor}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, plannedFor: e.target.value }))}
                  className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-audience" className="text-xs sm:text-sm font-medium">Audience</Label>
              <Select
                id="campaign-audience"
                value={campaignForm.audience}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, audience: e.target.value }))}
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              >
                {audienceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            {campaignForm.audience === 'custom' && (
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="campaign-custom-ids" className="text-xs sm:text-sm font-medium">Custom User IDs</Label>
                <Textarea
                  id="campaign-custom-ids"
                  value={campaignForm.customUserIds}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, customUserIds: e.target.value }))}
                  placeholder="One user ID per line"
                  className="rounded-xl border-stone-200 dark:border-[#3e3e42] min-h-[80px] text-sm font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="campaign-cta" className="text-xs sm:text-sm font-medium">
                CTA URL <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="campaign-cta"
                value={campaignForm.ctaUrl}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, ctaUrl: e.target.value }))}
                placeholder="https://..."
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>
          </div>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-stone-100 dark:border-[#2a2a2d] flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setCampaignSheetOpen(false)}
              className="w-full sm:flex-1 rounded-xl h-10 text-sm order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={campaignSaving}
              className="w-full sm:flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 h-10 text-sm order-1 sm:order-2"
            >
              {campaignSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {campaignForm.deliveryMode === 'send_now' ? 'Create & Send' : 'Schedule Campaign'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ============= TEMPLATE SHEET ============= */}
      <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg border-l border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] overflow-y-auto">
          <SheetHeader className="pb-4 sm:pb-6 border-b border-stone-100 dark:border-[#2a2a2d]">
            <SheetTitle className="text-lg sm:text-xl font-bold">
              {templateEditId ? 'Edit Template' : 'Create Template'}
            </SheetTitle>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              Define message variations for your campaigns and automations
            </p>
          </SheetHeader>

          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="template-title" className="text-xs sm:text-sm font-medium">Template Name</Label>
              <Input
                id="template-title"
                value={templateForm.title}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Daily Reminder"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="template-description" className="text-xs sm:text-sm font-medium">
                Description <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="template-description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Internal note about this template"
                className="rounded-xl border-stone-200 dark:border-[#3e3e42] min-h-[60px] text-sm"
              />
            </div>

            {/* Message Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs sm:text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message Variants ({templateForm.messageVariants.length})
                </Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg h-8 px-2"
                    onMouseEnter={() => setShowTemplateInfo(true)}
                    onMouseLeave={() => setShowTemplateInfo(false)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  {showTemplateInfo && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-[#1e1e20] border border-stone-200 dark:border-[#3e3e42] rounded-xl shadow-lg p-4">
                      <div className="text-sm font-semibold mb-2">Variables</div>
                      {TEMPLATE_VARIABLES.map((item) => (
                        <div key={item.variable} className="flex items-center gap-2 text-xs mb-1">
                          <code className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                            {item.variable}
                          </code>
                          <span className="text-stone-500">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {templateForm.messageVariants.length === 0 ? (
                  <div className="text-sm text-stone-500 text-center py-4 border border-dashed rounded-xl">
                    No messages yet. Add one below.
                  </div>
                ) : (
                  templateForm.messageVariants.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 border border-stone-200 dark:border-[#3e3e42] rounded-xl bg-stone-50 dark:bg-[#1a1a1d]"
                    >
                      <div className="flex-1 text-sm text-stone-700 dark:text-stone-300">
                        {variant}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => removeMessageVariant(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={newVariantText}
                  onChange={(e) => setNewVariantText(e.target.value)}
                  placeholder="Enter message variant..."
                  className="rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addMessageVariant()
                    }
                  }}
                />
                <Button
                  type="button"
                  className="rounded-xl bg-amber-600 hover:bg-amber-700"
                  onClick={addMessageVariant}
                  disabled={!newVariantText.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Translations Section */}
            {translationLanguages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-600" />
                    <Label className="text-sm font-medium">Translations</Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoTranslate}
                    disabled={isAutoTranslating || !templateForm.messageVariants.length}
                    className="rounded-lg h-8 text-xs border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    {isAutoTranslating ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        Auto-translate (DeepL)
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-stone-500">
                  Provide translated message variants for each language. Users will receive notifications in their preferred language.
                </p>

                {/* Language Tabs */}
                <div className="flex flex-wrap gap-2">
                  {translationLanguages.map((lang) => {
                    const hasTranslation = (templateTranslations[lang.code]?.length || 0) > 0
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedTranslationLang(selectedTranslationLang === lang.code ? null : lang.code)}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-lg border transition-all flex items-center gap-1.5",
                          selectedTranslationLang === lang.code
                            ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400"
                            : hasTranslation
                              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400"
                              : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400"
                        )}
                      >
                        <Languages className="h-3.5 w-3.5" />
                        {lang.label}
                        {hasTranslation && (
                          <span className="ml-1 text-xs opacity-75">({templateTranslations[lang.code]?.length})</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected Language Translation Editor */}
                {selectedTranslationLang && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Languages className="h-4 w-4 text-amber-600" />
                        {languages.find(l => l.code === selectedTranslationLang)?.label || selectedTranslationLang} Translation
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyDefaultToTranslation}
                        className="text-xs h-7 rounded-lg"
                        disabled={!templateForm.messageVariants.length}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy English
                      </Button>
                    </div>

                    {/* Translation Variants List */}
                    {(templateTranslations[selectedTranslationLang] || []).length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(templateTranslations[selectedTranslationLang] || []).map((variant, index) => (
                          <div key={index} className="flex items-start gap-2 group">
                            <div className="flex-1 p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-600 text-sm">
                              {variant}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTranslationVariant(selectedTranslationLang, index)}
                              className="p-1 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Translation Variant */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newTranslationVariantText}
                        onChange={(e) => setNewTranslationVariantText(e.target.value)}
                        placeholder={`Enter ${languages.find(l => l.code === selectedTranslationLang)?.label || selectedTranslationLang} message...`}
                        className="rounded-lg flex-1 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            addTranslationVariant()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-amber-600 hover:bg-amber-700"
                        onClick={addTranslationVariant}
                        disabled={!newTranslationVariantText.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Randomize Toggle */}
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-[#1a1a1d] rounded-xl border border-stone-200 dark:border-[#3e3e42]">
              <div>
                <Label className="text-sm font-medium">Randomize Variants</Label>
                <p className="text-xs text-stone-500">Each user receives a random variant</p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateForm(prev => ({ ...prev, randomize: !prev.randomize }))}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  templateForm.randomize ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    templateForm.randomize ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-stone-100 dark:border-[#2a2a2d] flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setTemplateSheetOpen(false)}
              className="w-full sm:flex-1 rounded-xl h-10 text-sm order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={templateSaving}
              className="w-full sm:flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 h-10 text-sm order-1 sm:order-2"
            >
              {templateSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {templateEditId ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default AdminNotificationsPanel
