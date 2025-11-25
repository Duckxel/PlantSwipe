import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import type { JSONContent } from "@tiptap/core"
import { supabase } from "@/lib/supabaseClient"
import { useNavigate } from "react-router-dom"

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

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export const AdminEmailTemplatesListPage: React.FC = () => {
  const navigate = useNavigate()
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([])
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

  React.useEffect(() => {
    loadTemplates().catch(() => {})
  }, [loadTemplates])

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
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to admin
          </button>
          <h1 className="text-3xl font-semibold">Email Templates</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
             Manage your reusable email layouts.
          </p>
        </div>
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
    </div>
  )
}

export default AdminEmailTemplatesListPage
