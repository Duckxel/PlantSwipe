import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Info,
  Loader2,
  ChevronLeft,
  Save
} from "lucide-react"
import { BlogEditor, type BlogEditorHandle } from "@/components/blog/BlogEditor"
import { VariableHighlighter } from "@/components/tiptap-extensions/variable-highlighter"
import type { JSONContent } from "@tiptap/core"
import { supabase } from "@/lib/supabaseClient"

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

const VARIABLE_CATALOG = [
  { token: "{{user}}", description: "Replaced with the user's display name" },
]

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

export const AdminEmailTemplatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === "new"

  const [loading, setLoading] = React.useState(!isNew)
  const [templateForm, setTemplateForm] = React.useState<{
    title: string
    subject: string
    description: string
    bodyHtml: string
    bodyDoc: JSONContent | null
  }>({
    title: "",
    subject: "",
    description: "",
    bodyHtml: "",
    bodyDoc: null,
  })
  const [templateSaving, setTemplateSaving] = React.useState(false)
  const [variableInfoOpen, setVariableInfoOpen] = React.useState(false)
  const templateEditorRef = React.useRef<BlogEditorHandle>(null)
  const [templateEditorKey, setTemplateEditorKey] = React.useState("initial")

  React.useEffect(() => {
    if (isNew) return
    
    const loadTemplate = async () => {
      setLoading(true)
      try {
        const headers = await buildAdminHeaders()
        // We need to fetch a specific template. 
        // Assuming /api/admin/email-templates returns all, we can filter or if there is an endpoint for one.
        // Looking at AdminEmailsPanel.tsx, it loads all.
        // Let's try to find a GET by ID or just load all and find. 
        // Usually /api/admin/email-templates/:id is supported if RESTful, but let's check if AdminEmailsPanel used it.
        // AdminEmailsPanel used DELETE on /api/admin/email-templates/:id. 
        // It didn't use GET on /:id, it used the list.
        // I'll try GET /:id, if not works I might need to implement it or use the list.
        // Let's try the list for now if I'm not sure about the backend. 
        // Actually, usually if I can DELETE /:id, I might be able to GET /:id.
        // But to be safe, I'll assume standard REST.
        
        const resp = await fetch(`/api/admin/email-templates/${id}`, { headers, credentials: "same-origin" })
        if (resp.ok) {
           const data = await resp.json()
           const tpl = data.template as EmailTemplate
           setTemplateForm({
             title: tpl.title,
             subject: tpl.subject,
             description: tpl.description || "",
             bodyHtml: tpl.bodyHtml,
             bodyDoc: tpl.bodyJson,
           })
           setTemplateEditorKey(`loaded-${tpl.id}`)
        } else {
           // Fallback: load all and find (if backend doesn't support GET /:id)
           const respList = await fetch("/api/admin/email-templates", { headers, credentials: "same-origin" })
           const dataList = await respList.json()
           const found = dataList.templates?.find((t: EmailTemplate) => t.id === id)
           if (found) {
             setTemplateForm({
                title: found.title,
                subject: found.subject,
                description: found.description || "",
                bodyHtml: found.bodyHtml,
                bodyDoc: found.bodyJson,
             })
             setTemplateEditorKey(`loaded-${found.id}`)
           } else {
             throw new Error("Template not found")
           }
        }
      } catch (err) {
        console.error(err)
        alert("Failed to load template")
        navigate("/admin")
      } finally {
        setLoading(false)
      }
    }
    loadTemplate()
  }, [id, isNew, navigate])

  const handleSave = async () => {
    if (!templateForm.title.trim() || !templateForm.subject.trim() || !templateForm.bodyHtml.trim()) {
      alert("Template title, subject, and body are required.")
      return
    }
    setTemplateSaving(true)
    try {
      const headers = await buildAdminHeaders()
      const payload = {
        title: templateForm.title.trim(),
        subject: templateForm.subject.trim(),
        previewText: "", // Removed as requested
        description: templateForm.description.trim(),
        bodyHtml: templateForm.bodyHtml,
        bodyJson: templateForm.bodyDoc,
        isActive: true,
      }
      
      const endpoint = isNew
        ? "/api/admin/email-templates"
        : `/api/admin/email-templates/${encodeURIComponent(id!)}`
      
      const method = isNew ? "POST" : "PUT"
      
      const resp = await fetch(endpoint, {
        method,
        headers,
        credentials: "same-origin",
        body: JSON.stringify(payload),
      })
      
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || "Failed to save template")
      
      alert("Template saved successfully")
      navigate("/admin") // Go back to admin panel (which defaults to campaigns but user can switch)
      // Ideally navigating back to where we came from.
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setTemplateSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 dark:bg-[#1e1e1e] md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? "New Email Template" : "Edit Email Template"}
              </h1>
              <p className="text-muted-foreground">
                Design the HTML layout for your emails.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={templateSaving}>
              {templateSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Template
            </Button>
          </div>
        </div>

        <div className="grid gap-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-[#3e3e42] dark:bg-[#2d2d30]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="template-title">Internal Title</Label>
              <Input
                id="template-title"
                value={templateForm.title}
                onChange={(event) =>
                  setTemplateForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="e.g. Monthly Newsletter"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-subject">Email Subject</Label>
              <Input
                id="template-subject"
                value={templateForm.subject}
                onChange={(event) =>
                  setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                }
                placeholder="What's new in your garden, {{user}}?"
              />
            </div>
          </div>
          
          {/* Preview text removed as requested */}

          <div className="grid gap-2">
            <Label htmlFor="template-description">Description (Internal)</Label>
            <Textarea
              id="template-description"
              value={templateForm.description}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Internal notes about this template..."
            />
          </div>

          <div className="space-y-2">
            <Label>Body Content</Label>
            <BlogEditor
              key={templateEditorKey}
              ref={templateEditorRef}
              initialHtml={templateForm.bodyHtml}
              initialDocument={templateForm.bodyDoc}
              uploadFolder="email-templates"
              extraExtensions={[VariableHighlighter]}
              className="min-h-[400px]"
              toolbarAppend={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setVariableInfoOpen(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              }
              onUpdate={({ html, doc }) =>
                setTemplateForm((prev) => ({ ...prev, bodyHtml: html, bodyDoc: doc }))
              }
            />
          </div>
        </div>
      </div>

      <Dialog open={variableInfoOpen} onOpenChange={setVariableInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Available variables</DialogTitle>
            <DialogDescription>Use these tokens to personalize outgoing emails.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {VARIABLE_CATALOG.map((variable) => (
              <div key={variable.token} className="rounded-xl border p-3">
                <Badge variant="secondary">{variable.token}</Badge>
                <p className="mt-1 text-sm text-muted-foreground">{variable.description}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVariableInfoOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminEmailTemplatePage
