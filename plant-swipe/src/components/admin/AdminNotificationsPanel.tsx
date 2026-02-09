import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import {
  BellRing,
  Play,
  Trash2,
  Plus,
  Clock,
  Send,
  Users,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Zap,
  Info,
  X,
  Search,
  Loader2,
  FileText,
  Copy,
  ChevronRight,
  Globe,
  Languages,
  Sparkles,
  Eye,
  EyeOff,
  Shuffle,
  PenLine,
  Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { Link, useLocation } from 'react-router-dom'
import { translateNotificationToAllLanguages } from '@/lib/deepl'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/i18n'

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
  lastRunSummary: Record<string, unknown> | null
  recipientCount: number
  sentTodayCount: number
  createdAt: string
  updatedAt: string
}

type AutomationMonitoring = {
  windowHours: number
  pushConfigured: boolean
  serverTime: string
  workerIntervalMs: number
  defaultTimezone: string
  totals: {
    queued: number
    sent: number
    failed: number
    pending: number
    noSubscription: number
  }
  lastQueuedAt: string | null
  failureReasons: Array<{
    reason: string
    count: number
  }>
  automations: Array<{
    id: string
    displayName: string | null
    total: number
    sent: number
    failed: number
    pending: number
    noSubscription: number
    lastQueuedAt: string | null
  }>
  recentNotifications: Array<{
    id: string
    userId: string
    automationId: string
    automationName: string | null
    status: string
    error: string | null
    scheduledFor: string | null
    deliveredAt: string | null
  }>
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
  const globalEnv = globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } }
  const adminToken = globalEnv.__ENV__?.VITE_ADMIN_STATIC_TOKEN
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
  const [monitoringOpen, setMonitoringOpen] = React.useState(false)
  const [monitoringLoading, setMonitoringLoading] = React.useState(false)
  const [monitoringError, setMonitoringError] = React.useState<string | null>(null)
  const [monitoringData, setMonitoringData] = React.useState<AutomationMonitoring | null>(null)

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
      if (!resp.ok) {
        console.error('[templates] Load failed:', data?.error)
        throw new Error(data?.error || 'Failed to load templates')
      }
      console.log('[templates] Loaded:', data?.templates?.length || 0, 'templates')
      setTemplates(Array.isArray(data?.templates) ? data.templates : [])
    } catch (err) {
      console.error('[templates] Error:', err)
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
      if (!resp.ok) {
        console.error('[automations] Load failed:', data?.error)
        throw new Error(data?.error || 'Failed to load automations')
      }
      console.log('[automations] Loaded:', data?.automations?.length || 0, 'automations')
      setAutomations(Array.isArray(data?.automations) ? data.automations : [])
    } catch (err) {
      console.error('[automations] Error:', err)
    } finally {
      setLoadingAutomations(false)
    }
  }, [])

  const loadMonitoring = React.useCallback(async () => {
    setMonitoringLoading(true)
    setMonitoringError(null)
    try {
      const headers = await buildAdminHeaders()
      const resp = await fetch('/api/admin/notification-automations/monitoring', { headers, credentials: 'same-origin' })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to load monitoring summary')
      }
      setMonitoringData(data?.monitoring || null)
    } catch (err) {
      setMonitoringError((err as Error).message)
    } finally {
      setMonitoringLoading(false)
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
      loadMonitoring().catch(() => {})
    }
  }, [activeView, loadCampaigns, loadTemplates, loadAutomations, loadMonitoring])

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

  const updateMessageVariant = React.useCallback((index: number, value: string) => {
    setTemplateForm(prev => {
      const nextVariants = [...prev.messageVariants]
      nextVariants[index] = value
      return { ...prev, messageVariants: nextVariants }
    })
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

  const updateTranslationVariant = React.useCallback((lang: string, index: number, value: string) => {
    setTemplateTranslations(prev => {
      const nextVariants = [...(prev[lang] || [])]
      nextVariants[index] = value
      return { ...prev, [lang]: nextVariants }
    })
  }, [])

  const copyDefaultToTranslation = React.useCallback(() => {
    if (!selectedTranslationLang) return
    setTemplateTranslations(prev => ({
      ...prev,
      [selectedTranslationLang]: [...templateForm.messageVariants],
    }))
  }, [selectedTranslationLang, templateForm.messageVariants])

  const updateActiveVariant = React.useCallback((index: number, value: string) => {
    if (selectedTranslationLang) {
      updateTranslationVariant(selectedTranslationLang, index, value)
    } else {
      updateMessageVariant(index, value)
    }
  }, [selectedTranslationLang, updateTranslationVariant, updateMessageVariant])

  const removeActiveVariant = React.useCallback((index: number) => {
    if (selectedTranslationLang) {
      removeTranslationVariant(selectedTranslationLang, index)
    } else {
      removeMessageVariant(index)
    }
  }, [selectedTranslationLang, removeTranslationVariant, removeMessageVariant])

  const addActiveVariant = React.useCallback(() => {
    if (selectedTranslationLang) {
      addTranslationVariant()
    } else {
      addMessageVariant()
    }
  }, [selectedTranslationLang, addTranslationVariant, addMessageVariant])

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
  const defaultLanguageLabel = React.useMemo(() => {
    return languages.find(lang => lang.code === DEFAULT_LANGUAGE)?.label || 'English'
  }, [languages])

  const translationLanguages = React.useMemo(() => {
    return languages.filter(lang => lang.code !== DEFAULT_LANGUAGE)
  }, [languages])

  const languageOptions = React.useMemo(() => {
    return [{ code: DEFAULT_LANGUAGE, label: defaultLanguageLabel }, ...translationLanguages]
  }, [defaultLanguageLabel, translationLanguages])

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
      console.log('[templates] Saving template:', payload)
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
      console.log('[templates] Save response:', resp.status, data)
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
  const activeLanguageCode = selectedTranslationLang || DEFAULT_LANGUAGE
  const activeLanguageLabel = languageOptions.find(lang => lang.code === activeLanguageCode)?.label || activeLanguageCode
  const activeVariants = activeLanguageCode === DEFAULT_LANGUAGE
    ? templateForm.messageVariants
    : (templateTranslations[activeLanguageCode] || [])
  const newVariantValue = selectedTranslationLang ? newTranslationVariantText : newVariantText
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
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setMonitoringOpen((prev) => !prev)}
                className="flex items-center gap-3 text-left"
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-stone-500 transition-transform",
                    monitoringOpen ? "rotate-90" : ""
                  )}
                />
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">Automation monitoring</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Delivery health for the last {monitoringData?.windowHours || 24} hours
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {monitoringLoading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => loadMonitoring()}
                  disabled={monitoringLoading}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {monitoringOpen && (
              <div className="border-t border-stone-100 dark:border-[#2a2a2d] p-4 space-y-4">
                {monitoringError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                    {monitoringError}
                  </div>
                )}

                {!monitoringError && !monitoringData && (
                  <p className="text-sm text-stone-500">No monitoring data available yet.</p>
                )}

                {monitoringData && (
                  <>
                    {!monitoringData.pushConfigured && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                        Push delivery is disabled on the server (missing VAPID keys). Automations can queue, but pushes will fail.
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        { label: 'Queued', value: monitoringData.totals.queued, accent: 'text-stone-900 dark:text-white' },
                        { label: 'Sent', value: monitoringData.totals.sent, accent: 'text-emerald-600 dark:text-emerald-300' },
                        { label: 'Failed', value: monitoringData.totals.failed, accent: 'text-red-600 dark:text-red-300' },
                        { label: 'Pending', value: monitoringData.totals.pending, accent: 'text-amber-600 dark:text-amber-300' },
                        { label: 'No subscription', value: monitoringData.totals.noSubscription, accent: 'text-stone-500 dark:text-stone-300' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-stone-200/70 bg-stone-50/80 px-4 py-3 dark:border-[#2a2a2d] dark:bg-[#151517]"
                        >
                          <p className="text-xs text-stone-500">{item.label}</p>
                          <p className={cn("text-lg font-semibold", item.accent)}>
                            {item.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                      <span>
                        Last queued: <span className="font-medium text-stone-700 dark:text-stone-200">{formatDateTime(monitoringData.lastQueuedAt)}</span>
                      </span>
                      <span>
                        Server time: <span className="font-medium text-stone-700 dark:text-stone-200">{formatDateTime(monitoringData.serverTime)}</span>
                      </span>
                      <span>
                        Worker interval: <span className="font-medium text-stone-700 dark:text-stone-200">{Math.round(monitoringData.workerIntervalMs / 1000)}s</span>
                      </span>
                      <span>
                        Default TZ: <span className="font-medium text-stone-700 dark:text-stone-200">{monitoringData.defaultTimezone}</span>
                      </span>
                    </div>

                    {monitoringData.failureReasons.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">Top failure reasons</p>
                        <div className="flex flex-wrap gap-2">
                          {monitoringData.failureReasons.map((reason) => (
                            <span
                              key={reason.reason}
                              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600 dark:border-[#2a2a2d] dark:bg-[#1c1c1f] dark:text-stone-300"
                            >
                              {reason.reason}: {reason.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">Automations (last 24h)</p>
                      <div className="space-y-2">
                        {monitoringData.automations.slice(0, 6).map((automation) => (
                          <div
                            key={automation.id}
                            className="flex flex-col gap-2 rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2 text-xs text-stone-600 dark:border-[#2a2a2d] dark:bg-[#151517] dark:text-stone-300 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="font-semibold text-stone-800 dark:text-stone-100">
                              {automation.displayName || 'Automation'}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span>Total: {automation.total}</span>
                              <span className="text-emerald-600 dark:text-emerald-300">Sent: {automation.sent}</span>
                              <span className="text-red-600 dark:text-red-300">Failed: {automation.failed}</span>
                              <span className="text-amber-600 dark:text-amber-300">Pending: {automation.pending}</span>
                              <span>No sub: {automation.noSubscription}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">Recent deliveries</p>
                      {monitoringData.recentNotifications.length === 0 ? (
                        <p className="text-xs text-stone-500">No deliveries logged yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {monitoringData.recentNotifications.map((entry) => {
                            const statusColor =
                              entry.status === 'sent'
                                ? 'text-emerald-600 dark:text-emerald-300'
                                : entry.status === 'failed'
                                  ? 'text-red-600 dark:text-red-300'
                                  : 'text-amber-600 dark:text-amber-300'
                            return (
                              <div
                                key={entry.id}
                                className="rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2 text-xs text-stone-600 dark:border-[#2a2a2d] dark:bg-[#151517] dark:text-stone-300"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("font-semibold", statusColor)}>{entry.status}</span>
                                  <span className="text-stone-400">•</span>
                                  <span className="font-medium text-stone-800 dark:text-stone-100">
                                    {entry.automationName || 'Automation'}
                                  </span>
                                  <span className="text-stone-400">•</span>
                                  <span className="font-mono text-[11px]">
                                    {entry.userId?.slice(0, 8)}…
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-stone-500">
                                  <span>Scheduled: {formatDateTime(entry.scheduledFor)}</span>
                                  <span>Delivered: {formatDateTime(entry.deliveredAt)}</span>
                                  {entry.error && <span className="text-red-500">Error: {entry.error}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

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
                  <strong>💡 How it works:</strong> Scheduled automations run every hour. Daily task reminders respect each user's
                  notification time preference. Event-driven automations (like Plant Request Fulfilled) trigger automatically
                  when the corresponding action occurs. Configure a template and enable the trigger to start sending.
                </p>
              </div>

              <div className="grid gap-4">
                {automations.map((automation) => {
                  const isDailyTaskReminder = automation.triggerType === 'daily_task_reminder'
                  const isEventDriven = automation.triggerType === 'plant_request_fulfilled'

                  return (
                    <div
                      key={automation.id}
                      className={cn(
                        "rounded-xl sm:rounded-2xl border p-5 sm:p-6 transition-all",
                        automation.sentTodayCount > 0
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
                          : "border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20]"
                      )}
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
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                            {automation.sentTodayCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {automation.sentTodayCount} sent today
                              </span>
                            )}
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
                                {isEventDriven
                                  ? `~${automation.recipientCount.toLocaleString()} users with pending requests`
                                  : `~${automation.recipientCount.toLocaleString()} recipients`}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {isEventDriven
                                ? "Triggered instantly when a plant request is fulfilled"
                                : isDailyTaskReminder
                                  ? "Uses each user's preferred notification time"
                                  : `Sends at ${automation.sendHour}:00 (user's local time)`}
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

                        {/* Send Hour (hidden for event-driven automations) */}
                        {!isEventDriven && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                            Send Hour (User's Local Time)
                          </Label>
                          {isDailyTaskReminder ? (
                            <div className="rounded-lg border border-dashed border-stone-200 dark:border-[#3e3e42] px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                              Uses each user's notification time preference.
                            </div>
                          ) : (
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
                          )}
                        </div>
                        )}

                        {/* Event-driven info */}
                        {isEventDriven && (
                          <div className="rounded-lg border border-dashed border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                            <strong>Event-driven:</strong> This notification is sent instantly when a plant request is fulfilled
                            via AI Prefill or manual plant creation. Use <code className="bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">{'{{plant}}'}</code> in
                            your template to include the plant name.
                          </div>
                        )}

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
                          {!isEventDriven && (
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
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
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

      {/* ============= TEMPLATE EDITOR MODAL ============= */}
      <Dialog open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
        <DialogContent 
          className="w-[95vw] max-w-5xl h-[90vh] max-h-[900px] p-0 gap-0 rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1d] border border-stone-200 dark:border-[#3e3e42]"
          hideCloseButton
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-[#2a2a2d] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-stone-900 dark:text-white">
                  {templateEditId ? 'Edit Template' : 'Create Template'}
                </DialogTitle>
                <DialogDescription className="text-sm text-stone-500 dark:text-stone-400">
                  Design message variations for your notifications
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateSheetOpen(false)}
                className="rounded-lg h-9 px-3"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={templateSaving}
                className="rounded-lg h-9 px-4 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-500/20"
              >
                {templateSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {templateEditId ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            {/* Left Panel - Template Info */}
            <div className="w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-[#2a2a2d] bg-stone-50/50 dark:bg-[#151517] overflow-y-auto">
              <div className="p-5 space-y-5">
                {/* Template Name */}
                <div className="space-y-2">
                  <Label htmlFor="template-title" className="text-sm font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-amber-500" />
                    Template Name
                  </Label>
                  <Input
                    id="template-title"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Daily Reminder"
                    className="rounded-xl border-stone-200 dark:border-[#3e3e42] h-11 bg-white dark:bg-[#1e1e20]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="template-description" className="text-sm font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-2">
                    <Type className="h-4 w-4 text-amber-500" />
                    Description
                    <span className="text-stone-400 font-normal text-xs">(optional)</span>
                  </Label>
                  <Textarea
                    id="template-description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Internal note about this template"
                    className="rounded-xl border-stone-200 dark:border-[#3e3e42] min-h-[80px] bg-white dark:bg-[#1e1e20] resize-none"
                  />
                </div>

                {/* Variables Info */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-900/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Available Variables</span>
                  </div>
                  <div className="space-y-2">
                    {TEMPLATE_VARIABLES.map((item) => (
                      <div key={item.variable} className="flex items-center gap-2">
                        <code
                          className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-mono cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                          onClick={() => navigator.clipboard?.writeText(item.variable)}
                          title="Click to copy"
                        >
                          {item.variable}
                        </code>
                        <span className="text-xs text-amber-700/70 dark:text-amber-300/70">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-stone-700 dark:text-stone-300">Settings</Label>
                  
                  {/* Randomize Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1e1e20] rounded-xl border border-stone-200 dark:border-[#3e3e42]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Shuffle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200">Randomize</span>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Random variant per user</p>
                      </div>
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

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1e1e20] rounded-xl border border-stone-200 dark:border-[#3e3e42]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        {templateForm.isActive ? (
                          <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-stone-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200">Active</span>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Available for campaigns</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTemplateForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className={cn(
                        "relative h-7 w-12 rounded-full transition-colors",
                        templateForm.isActive ? "bg-emerald-500" : "bg-stone-300 dark:bg-stone-600"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          templateForm.isActive ? "left-6" : "left-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Message Variants */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Language Tabs Header */}
              <div className="flex-shrink-0 border-b border-stone-200 dark:border-[#2a2a2d] bg-white dark:bg-[#1e1e20]">
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">Message Variants</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                        {activeVariants.length} variant{activeVariants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTranslationLang && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyDefaultToTranslation}
                          className="text-xs h-8 rounded-lg"
                          disabled={!templateForm.messageVariants.length}
                        >
                          <Copy className="h-3 w-3 mr-1.5" />
                          Copy from English
                        </Button>
                      )}
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
                            Translate from English
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Language Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
                    {languageOptions.map((lang) => {
                      const variantCount = lang.code === DEFAULT_LANGUAGE
                        ? templateForm.messageVariants.length
                        : (templateTranslations[lang.code]?.length || 0)
                      const hasTranslation = lang.code !== DEFAULT_LANGUAGE && variantCount > 0
                      const isSelected = (selectedTranslationLang || DEFAULT_LANGUAGE) === lang.code
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setSelectedTranslationLang(lang.code === DEFAULT_LANGUAGE ? null : lang.code)}
                          className={cn(
                            "relative px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
                            isSelected
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                              : hasTranslation
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                                : "bg-stone-100 dark:bg-[#2a2a2d] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-[#3a3a3d]"
                          )}
                        >
                          <Languages className="h-4 w-4" />
                          {lang.label}
                          {variantCount > 0 && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                              isSelected
                                ? "bg-white/20 text-white"
                                : hasTranslation
                                  ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                                  : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                            )}>
                              {variantCount}
                            </span>
                          )}
                          {hasTranslation && !isSelected && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Variants List - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 bg-stone-50/50 dark:bg-[#151517]">
                {selectedTranslationLang && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
                    <Languages className="h-5 w-5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Editing {activeLanguageLabel} translation
                      </div>
                      <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        These variants will be shown to users with {activeLanguageLabel} language preference. 
                        English variants serve as the default.
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {activeVariants.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-stone-200 dark:border-[#3e3e42] rounded-2xl bg-white dark:bg-[#1e1e20]">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                        <MessageSquare className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-base font-semibold text-stone-900 dark:text-white mb-1">
                        {selectedTranslationLang ? 'No translations yet' : 'No message variants'}
                      </h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 max-w-sm mx-auto">
                        {selectedTranslationLang 
                          ? `Add ${activeLanguageLabel} translations using the field below.`
                          : 'Add your first message variant using the field below.'}
                      </p>
                    </div>
                  ) : (
                    activeVariants.map((variant, index) => (
                      <div
                        key={index}
                        className="group relative rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-md"
                      >
                        {/* Variant Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-stone-50 dark:bg-[#252528] border-b border-stone-100 dark:border-[#2a2a2d]">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold">
                              {index + 1}
                            </div>
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                              Variant {index + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-7 w-7 p-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                              onClick={() => navigator.clipboard?.writeText(variant)}
                              title="Copy variant"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => removeActiveVariant(index)}
                              title="Delete variant"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Variant Content */}
                        <div className="p-4">
                          <Textarea
                            value={variant}
                            onChange={(e) => updateActiveVariant(index, e.target.value)}
                            rows={3}
                            className="w-full min-h-[80px] resize-none rounded-lg border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#151517] focus:bg-white dark:focus:bg-[#1e1e20] text-sm text-stone-700 dark:text-stone-300 transition-colors"
                            placeholder="Enter your notification message..."
                          />
                          <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
                            <span>{variant.length} characters</span>
                            {variant.includes('{{') && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Info className="h-3 w-3" />
                                Contains variables
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Preview Card */}
                {activeVariants.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="h-4 w-4 text-stone-400" />
                      <span className="text-sm font-medium text-stone-600 dark:text-stone-400">Preview</span>
                      <span className="text-xs text-stone-400">(random variant)</span>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-800/50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                          <BellRing className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-stone-900 dark:text-white">Aphylia</span>
                            <span className="text-xs text-stone-400">now</span>
                          </div>
                          <p className="text-sm text-stone-700 dark:text-stone-300 break-words">
                            {activeVariants[Math.floor(Math.random() * activeVariants.length)]
                              .replace(/\{\{user\}\}/g, 'John')
                              .replace(/\{\{email\}\}/g, 'john@example.com')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Add New Variant - Fixed at Bottom */}
              <div className="flex-shrink-0 border-t border-stone-200 dark:border-[#2a2a2d] bg-white dark:bg-[#1e1e20] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={newVariantValue}
                    onChange={(e) => {
                      if (selectedTranslationLang) {
                        setNewTranslationVariantText(e.target.value)
                      } else {
                        setNewVariantText(e.target.value)
                      }
                    }}
                    placeholder={selectedTranslationLang
                      ? `Add ${activeLanguageLabel} variant...`
                      : 'Add new variant...'}
                    className="flex-1 h-10 rounded-lg border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#151517] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newVariantValue.trim()) {
                        e.preventDefault()
                        addActiveVariant()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg h-10 px-4 bg-amber-600 hover:bg-amber-700"
                    onClick={addActiveVariant}
                    disabled={!newVariantValue.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminNotificationsPanel
