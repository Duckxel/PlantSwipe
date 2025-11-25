import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Save,
  Eye,
  X,
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
  const [previewOpen, setPreviewOpen] = React.useState(false)

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
      navigate("/admin/emails/templates") 
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setTemplateSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 dark:from-[#0f0f11] dark:to-[#1a1a1d]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading template...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-emerald-50/50 dark:from-[#0a0a0c] dark:via-[#111113] dark:to-[#0a0a0c] p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Rounded Background Wrapper */}
        <div className="rounded-3xl bg-white/80 dark:bg-[#1a1a1d]/90 backdrop-blur-xl border border-stone-200/50 dark:border-[#2a2a2d] shadow-xl shadow-stone-200/50 dark:shadow-black/20 p-6 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate("/admin/emails/templates")}
              className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-emerald-600 dark:text-stone-400 dark:hover:text-emerald-400 transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </button>
            
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
                  {isNew ? "Create Template" : "Edit Template"}
                </h1>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                  Design beautiful emails with the rich text editor
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!templateForm.bodyHtml.trim()}
                  className="rounded-xl border-stone-200 dark:border-[#3e3e42] hover:border-emerald-300 dark:hover:border-emerald-800"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={templateSaving}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                >
                  {templateSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isNew ? "Create Template" : "Save Changes"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-[340px,1fr] gap-6">
          {/* Sidebar - Template Settings */}
          <div className="space-y-5">
            {/* Template Info Card */}
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Save className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                Template Details
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-title" className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    Template Name
                  </Label>
                  <Input
                    id="template-title"
                    value={templateForm.title}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="e.g., Monthly Newsletter"
                    className="rounded-xl border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2a2a2d] focus:bg-white dark:focus:bg-[#1e1e20]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-subject" className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    Email Subject Line
                  </Label>
                  <Input
                    id="template-subject"
                    value={templateForm.subject}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    placeholder="What's new, {{user}}?"
                    className="rounded-xl border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2a2a2d] focus:bg-white dark:focus:bg-[#1e1e20]"
                  />
                  <p className="text-[11px] text-stone-400">This is what recipients see in their inbox</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-description" className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    Internal Notes
                  </Label>
                  <Textarea
                    id="template-description"
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Notes about this template..."
                    className="min-h-[70px] rounded-xl border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2a2a2d] focus:bg-white dark:focus:bg-[#1e1e20] resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Variables Card */}
            <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Info className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Variables
                </h2>
                <button
                  type="button"
                  onClick={() => setVariableInfoOpen(true)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  View all
                </button>
              </div>
              
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                Use these to personalize emails
              </p>
              
              <div className="flex flex-wrap gap-2">
                {VARIABLE_CATALOG.map(v => (
                  <span 
                    key={v.token} 
                    className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#2a2a2d] text-xs font-mono text-stone-700 dark:text-stone-300 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                    onClick={() => {
                      navigator.clipboard?.writeText(v.token)
                    }}
                    title="Click to copy"
                  >
                    {v.token}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats Card (only for existing templates) */}
            {existingTemplate && (
              <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Stats
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-stone-50 dark:bg-[#2a2a2d] p-3 text-center">
                    <div className="text-lg font-bold text-stone-900 dark:text-white">v{existingTemplate.version}</div>
                    <div className="text-[11px] text-stone-500">Version</div>
                  </div>
                  <div className="rounded-xl bg-stone-50 dark:bg-[#2a2a2d] p-3 text-center">
                    <div className="text-lg font-bold text-stone-900 dark:text-white">{existingTemplate.campaignCount}</div>
                    <div className="text-[11px] text-stone-500">Campaigns</div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-stone-100 dark:border-[#2a2a2d] text-xs text-stone-500">
                  Last updated: {new Date(existingTemplate.updatedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Editor Section */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100 dark:border-[#2a2a2d] flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Email Content</span>
              {templateForm.bodyHtml.length > 0 && (
                <span className="text-xs text-stone-400">{templateForm.bodyHtml.length} characters</span>
              )}
            </div>
            
            <BlogEditor
              key={templateEditorKey}
              ref={templateEditorRef}
              initialHtml={initialBody.html}
              initialDocument={initialBody.doc}
              uploadFolder="email-templates"
              extraExtensions={[VariableHighlighter]}
              className="min-h-[600px]"
              onUpdate={({ html, doc }) =>
                setTemplateForm((prev) => ({ ...prev, bodyHtml: html, bodyDoc: doc }))
              }
            />
          </div>
        </div>
        </div>
      </div>

      {/* Variable Info Dialog */}
      <Dialog open={variableInfoOpen} onOpenChange={setVariableInfoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Available Variables</DialogTitle>
            <DialogDescription>Click a variable to copy it to your clipboard</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {VARIABLE_CATALOG.map((variable) => (
              <div 
                key={variable.token} 
                className="rounded-xl border border-stone-200 dark:border-[#3e3e42] p-4 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all"
                onClick={() => {
                  navigator.clipboard?.writeText(variable.token)
                }}
              >
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-sm font-mono text-emerald-700 dark:text-emerald-400">
                  {variable.token}
                </span>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{variable.description}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVariableInfoOpen(false)} className="rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview - Full Screen Overlay (always light theme) */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
          style={{ 
            background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 30%, #ffffff 70%, #fef3c7 100%)',
            colorScheme: 'light',
          }}
        >
          {/* Google Fonts for Quicksand */}
          <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&display=swap" rel="stylesheet" />
          
          {/* Email Content Styles */}
          <style>{`
            .email-preview-body h1 {
              font-size: 32px !important;
              font-weight: 700 !important;
              color: #111827 !important;
              margin: 0 0 20px 0 !important;
              line-height: 1.2 !important;
              letter-spacing: -0.5px !important;
            }
            .email-preview-body h2 {
              font-size: 26px !important;
              font-weight: 700 !important;
              color: #1f2937 !important;
              margin: 32px 0 16px 0 !important;
              line-height: 1.3 !important;
            }
            .email-preview-body h3 {
              font-size: 22px !important;
              font-weight: 600 !important;
              color: #374151 !important;
              margin: 28px 0 12px 0 !important;
              line-height: 1.4 !important;
            }
            .email-preview-body h4 {
              font-size: 18px !important;
              font-weight: 600 !important;
              color: #4b5563 !important;
              margin: 24px 0 10px 0 !important;
            }
            .email-preview-body p {
              margin: 0 0 16px 0 !important;
              line-height: 1.75 !important;
              color: #374151 !important;
            }
            .email-preview-body a {
              color: #059669 !important;
              text-decoration: underline !important;
              text-decoration-color: rgba(5, 150, 105, 0.4) !important;
              text-underline-offset: 2px !important;
              font-weight: 500 !important;
              transition: all 0.15s ease !important;
            }
            .email-preview-body a:hover {
              color: #047857 !important;
              text-decoration-color: #047857 !important;
            }
            .email-preview-body code {
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%) !important;
              color: #dc2626 !important;
              padding: 3px 8px !important;
              border-radius: 6px !important;
              font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace !important;
              font-size: 0.9em !important;
              border: 1px solid rgba(0, 0, 0, 0.08) !important;
              font-weight: 500 !important;
            }
            .email-preview-body pre {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
              color: #e5e7eb !important;
              padding: 20px 24px !important;
              border-radius: 16px !important;
              overflow-x: auto !important;
              font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
              margin: 20px 0 !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
            }
            .email-preview-body pre code {
              background: transparent !important;
              color: #e5e7eb !important;
              padding: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              font-size: inherit !important;
            }
            .email-preview-body mark,
            .email-preview-body [data-color] {
              background: linear-gradient(135deg, #fef08a 0%, #fde047 100%) !important;
              color: #713f12 !important;
              padding: 2px 6px !important;
              border-radius: 4px !important;
              box-decoration-break: clone !important;
              -webkit-box-decoration-break: clone !important;
            }
            .email-preview-body blockquote {
              border-left: 4px solid #10b981 !important;
              background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%) !important;
              margin: 20px 0 !important;
              padding: 16px 24px !important;
              border-radius: 0 12px 12px 0 !important;
              font-style: italic !important;
              color: #374151 !important;
            }
            .email-preview-body ul, .email-preview-body ol {
              margin: 16px 0 !important;
              padding-left: 28px !important;
            }
            .email-preview-body li {
              margin: 8px 0 !important;
              color: #374151 !important;
            }
            .email-preview-body hr {
              border: none !important;
              height: 2px !important;
              background: linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%) !important;
              margin: 32px 0 !important;
            }
            .email-preview-body strong, .email-preview-body b {
              font-weight: 600 !important;
              color: #111827 !important;
            }
            .email-preview-body em, .email-preview-body i {
              font-style: italic !important;
            }
            .email-preview-body img {
              max-width: 100% !important;
              height: auto !important;
              border-radius: 12px !important;
            }
            /* Email Card Styles */
            .email-preview-body [data-type="email-card"] {
              margin: 28px 0 !important;
              padding: 0 !important;
              border-radius: 20px !important;
              background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(255, 255, 255, 1) 50%, rgba(16, 185, 129, 0.06) 100%) !important;
              border: 2px solid rgba(16, 185, 129, 0.25) !important;
              box-shadow: 0 8px 32px rgba(16, 185, 129, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
              overflow: hidden !important;
            }
            .email-preview-body [data-type="email-card"] table {
              margin: 0 !important;
              border: none !important;
            }
            .email-preview-body [data-type="email-card"] td {
              padding: 24px !important;
              border: none !important;
            }
            .email-preview-body [data-type="email-card"] td:first-child {
              padding-right: 8px !important;
              font-size: 32px !important;
            }
            .email-preview-body [data-type="email-card"] strong {
              display: block !important;
              font-size: 17px !important;
              font-weight: 700 !important;
              color: #065f46 !important;
              margin-bottom: 6px !important;
              letter-spacing: -0.3px !important;
            }
            .email-preview-body [data-type="email-card"] > table > tbody > tr > td:last-child > div > div {
              font-size: 15px !important;
              color: #374151 !important;
              line-height: 1.6 !important;
            }
            /* Email Button Styles */
            .email-preview-body [data-type="email-button"] a,
            .email-preview-body a[style*="border-radius"][style*="padding"] {
              display: inline-block !important;
              background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
              color: #ffffff !important;
              padding: 14px 32px !important;
              border-radius: 50px !important;
              text-decoration: none !important;
              font-weight: 600 !important;
              font-size: 15px !important;
              box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35) !important;
              transition: all 0.2s ease !important;
            }
            /* Table styling */
            .email-preview-body table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 20px 0 !important;
            }
            .email-preview-body th, .email-preview-body td {
              padding: 12px 16px !important;
              border: 1px solid #e5e7eb !important;
              text-align: left !important;
            }
            .email-preview-body th {
              background: #f9fafb !important;
              font-weight: 600 !important;
              color: #111827 !important;
            }
          `}</style>
          {/* Floating Controls */}
          <div 
            className="fixed top-6 left-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-2xl shadow-2xl"
            style={{ 
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Subject */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <span style={{ color: '#9ca3af' }}>Subject:</span>
              <span style={{ fontWeight: 500, color: '#374151', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {templateForm.subject.replace(/\{\{user\}\}/gi, "John") || "(No subject)"}
              </span>
            </div>

            <div style={{ height: '24px', width: '1px', background: '#e5e7eb' }} />
            
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '9999px',
                background: '#f3f4f6',
                border: 'none',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              <X style={{ width: '16px', height: '16px' }} />
              Close
            </button>
          </div>

          {/* Email Content */}
          <div style={{ flex: 1, paddingTop: '80px', paddingBottom: '80px', paddingLeft: '24px', paddingRight: '24px' }}>
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
              {/* Email Container */}
              <div 
                style={{
                  borderRadius: '32px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(255, 255, 255, 0.99) 50%, rgba(251, 191, 36, 0.03) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.12)',
                  boxShadow: '0 32px 64px -16px rgba(16, 185, 129, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
                }}
              >
                {/* Header */}
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                    padding: '32px 48px',
                    textAlign: 'center',
                  }}
                >
                  <div 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '20px',
                      padding: '14px 28px',
                    }}
                  >
                    <img 
                      src="/icons/plant-swipe-icon.svg" 
                      alt="" 
                      style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }}
                    />
                    <span 
                      style={{ 
                        fontSize: '26px', 
                        fontWeight: 700, 
                        color: '#ffffff', 
                        letterSpacing: '-0.5px',
                        fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
                      }}
                    >
                      Aphylia
                    </span>
                  </div>
                </div>

                {/* Email Body */}
                <div 
                  className="email-preview-body"
                  style={{ 
                    padding: '48px', 
                    color: '#374151', 
                    fontSize: '16px', 
                    lineHeight: 1.75,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: templateForm.bodyHtml.replace(/\{\{user\}\}/gi, "John") || "<p style='color:#9ca3af;font-style:italic;'>Start writing your email content...</p>" 
                  }}
                />

                {/* Signature Section */}
                <div style={{ margin: '0 48px 48px 48px' }}>
                  <div 
                    style={{ 
                      borderRadius: '20px',
                      padding: '28px 32px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {/* Logo */}
                      <div 
                        style={{
                          flexShrink: 0,
                          width: '56px',
                          height: '56px',
                          borderRadius: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          boxShadow: '0 8px 24px -8px rgba(16, 185, 129, 0.5)',
                        }}
                      >
                        <img 
                          src="/icons/plant-swipe-icon.svg" 
                          alt="Aphylia" 
                          style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }}
                        />
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: '18px', color: '#1f2937' }}>
                          The Aphylia Team
                        </p>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                          Helping you grow your plant knowledge 🌱
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div 
                  style={{ 
                    padding: '32px 48px', 
                    textAlign: 'center',
                    borderTop: '1px solid rgba(16, 185, 129, 0.08)',
                  }}
                >
                  <a 
                    href="#"
                    style={{
                      display: 'inline-block',
                      marginBottom: '24px',
                      padding: '14px 32px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#ffffff',
                      borderRadius: '9999px',
                      textDecoration: 'none',
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      boxShadow: '0 8px 24px -6px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    Explore Aphylia →
                  </a>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#9ca3af' }}>
                    <a href="#" style={{ color: '#059669', fontWeight: 500, textDecoration: 'none' }}>aphylia.app</a>
                    <span style={{ margin: '0 8px', color: '#d1d5db' }}>•</span>
                    <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>About</a>
                    <span style={{ margin: '0 8px', color: '#d1d5db' }}>•</span>
                    <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Contact</a>
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db' }}>
                    © {new Date().getFullYear()} Aphylia. Made with 💚 for plant enthusiasts everywhere.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          <div 
            className="fixed bottom-6 left-1/2 z-50"
            style={{ transform: 'translateX(-50%)' }}
          >
            <p 
              style={{ 
                fontSize: '12px', 
                color: '#9ca3af', 
                background: 'rgba(255, 255, 255, 0.9)', 
                backdropFilter: 'blur(8px)',
                padding: '8px 16px', 
                borderRadius: '9999px', 
                border: '1px solid rgba(0, 0, 0, 0.08)',
                margin: 0,
              }}
            >
              Variables like <code style={{ padding: '2px 6px', background: '#f3f4f6', borderRadius: '4px', color: '#059669', fontSize: '10px' }}>{"{{user}}"}</code> are replaced with sample data
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminEmailTemplatePage
