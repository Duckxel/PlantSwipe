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
  ArrowLeft,
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
  
  // Separate state for initial content to prevent editor re-renders loop
  const [initialBody, setInitialBody] = React.useState<{ html: string; doc: JSONContent | null }>({ html: "", doc: null })
  
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
  const [existingTemplate, setExistingTemplate] = React.useState<EmailTemplate | null>(null)

  React.useEffect(() => {
    if (isNew) return
    
    const loadTemplate = async () => {
      setLoading(true)
      try {
        const headers = await buildAdminHeaders()
        const resp = await fetch(`/api/admin/email-templates/${id}`, { headers, credentials: "same-origin" })
        
        let foundTemplate: EmailTemplate | null = null;

        if (resp.ok) {
           const data = await resp.json()
           foundTemplate = data.template
        } else {
           // Fallback: load all
           const respList = await fetch("/api/admin/email-templates", { headers, credentials: "same-origin" })
           const dataList = await respList.json()
           foundTemplate = dataList.templates?.find((t: EmailTemplate) => t.id === id) || null
        }

        if (foundTemplate) {
          setExistingTemplate(foundTemplate)
          setTemplateForm({
             title: foundTemplate.title,
             subject: foundTemplate.subject,
             description: foundTemplate.description || "",
             bodyHtml: foundTemplate.bodyHtml,
             bodyDoc: foundTemplate.bodyJson,
          })
          setInitialBody({
            html: foundTemplate.bodyHtml,
            doc: foundTemplate.bodyJson,
          })
          setTemplateEditorKey(`loaded-${foundTemplate.id}`)
        } else {
           throw new Error("Template not found")
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
        previewText: "",
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
      
      // alert("Template saved successfully")
      navigate("/admin") 
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
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header Section */}
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
          <h1 className="text-3xl font-semibold">
            {isNew ? "Create Email Template" : "Edit Email Template"}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Design the HTML layout for your emails using the rich text editor.
          </p>
        </div>
        {existingTemplate && (
          <Badge variant="outline" className="rounded-2xl px-3 py-1 text-xs uppercase tracking-wide">
            Updated: {new Date(existingTemplate.updatedAt).toLocaleDateString()}
          </Badge>
        )}
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        {/* Left Column: Main Info (Vertical Stack) */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-title">Internal Title</Label>
            <Input
              id="template-title"
              value={templateForm.title}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="e.g. Monthly Newsletter"
              className="rounded-2xl"
            />
            <p className="text-xs text-stone-500">Only visible to admins.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-subject">Email Subject</Label>
            <Input
              id="template-subject"
              value={templateForm.subject}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder="What's new in your garden, {{user}}?"
              className="rounded-2xl"
            />
            <p className="text-xs text-stone-500">Visible to recipients.</p>
          </div>
          
          {/* Description & Variables vertically stacked */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Description (Internal)</Label>
            <Textarea
              id="template-description"
              value={templateForm.description}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Internal notes about this template..."
              className="min-h-[80px] rounded-2xl resize-y"
            />
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Variables</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Personalize your emails with dynamic content.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-2xl h-8 px-2"
                onClick={() => setVariableInfoOpen(true)}
              >
                <Info className="mr-2 h-3 w-3" />
                View List
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {VARIABLE_CATALOG.slice(0, 3).map(v => (
                <Badge key={v.token} variant="secondary" className="font-mono text-xs rounded-md">
                  {v.token}
                </Badge>
              ))}
              {VARIABLE_CATALOG.length > 3 && (
                <span className="text-xs text-muted-foreground self-center">+{VARIABLE_CATALOG.length - 3} more</span>
              )}
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] p-3 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between">
            <span>Use the toolbar to format text, add images, or insert variables.</span>
            {templateForm.bodyHtml.length > 0 && (
               <span className="opacity-60">{templateForm.bodyHtml.length} chars</span>
            )}
          </div>
          
          <BlogEditor
            key={templateEditorKey}
            ref={templateEditorRef}
            initialHtml={initialBody.html}
            initialDocument={initialBody.doc}
            uploadFolder="email-templates"
            extraExtensions={[VariableHighlighter]}
            className="min-h-[500px]"
            onUpdate={({ html, doc }) =>
              setTemplateForm((prev) => ({ ...prev, bodyHtml: html, bodyDoc: doc }))
            }
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/admin")}
            className="rounded-2xl"
            disabled={templateSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={templateSaving}
            className="rounded-2xl"
          >
            {templateSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Variable Info Dialog */}
      <Dialog open={variableInfoOpen} onOpenChange={setVariableInfoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Available variables</DialogTitle>
            <DialogDescription>Use these tokens to personalize outgoing emails.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {VARIABLE_CATALOG.map((variable) => (
              <div key={variable.token} className="rounded-xl border p-3">
                <Badge variant="secondary" className="font-mono">{variable.token}</Badge>
                <p className="mt-1 text-sm text-muted-foreground">{variable.description}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVariableInfoOpen(false)} className="rounded-2xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminEmailTemplatePage
