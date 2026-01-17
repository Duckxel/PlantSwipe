import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import {
  Bug,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Users,
  Zap,
  Target,
  AlertCircle,
  Loader2,
  ChevronRight,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Edit2,
  Archive,
  Play,
  Pause,
  Save,
} from "lucide-react"

type BugAction = {
  id: string
  title: string
  description: string | null
  points_reward: number
  status: 'draft' | 'planned' | 'active' | 'closed'
  release_date: string | null
  questions: Array<{
    id: string
    title: string
    required: boolean
    type: 'text' | 'textarea' | 'boolean'
  }>
  created_at: string
  completed_count: number
}

type BugReport = {
  id: string
  user_id: string
  bug_name: string
  description: string
  steps_to_reproduce: string | null
  screenshots: string[]
  user_info: {
    username?: string
    role?: string
    server?: string
    device?: string
  }
  console_logs: string | null
  status: 'pending' | 'reviewing' | 'closed' | 'completed'
  points_earned: number
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
  // Joined data
  user_display_name?: string
}

type BugCatcherStats = {
  total_bug_catchers: number
  total_actions: number
  active_actions: number
  total_responses: number
  pending_bug_reports: number
  total_points_awarded: number
}

type AdminView = 'overview' | 'actions' | 'reports'

export const AdminBugsPanel: React.FC = () => {
  const { user } = useAuth()
  const [view, setView] = React.useState<AdminView>('overview')
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  
  // Stats
  const [stats, setStats] = React.useState<BugCatcherStats | null>(null)
  
  // Actions
  const [actions, setActions] = React.useState<BugAction[]>([])
  const [selectedAction, setSelectedAction] = React.useState<BugAction | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = React.useState(false)
  const [editingAction, setEditingAction] = React.useState<Partial<BugAction> | null>(null)
  const [savingAction, setSavingAction] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  
  // Bug Reports
  const [bugReports, setBugReports] = React.useState<BugReport[]>([])
  const [selectedReport, setSelectedReport] = React.useState<BugReport | null>(null)
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false)
  const [processingReport, setProcessingReport] = React.useState(false)
  const [adminNotes, setAdminNotes] = React.useState('')
  const [bonusPoints, setBonusPoints] = React.useState(15)

  // Action responses for viewing
  const [viewingResponses, setViewingResponses] = React.useState<any[]>([])
  const [responsesDialogOpen, setResponsesDialogOpen] = React.useState(false)

  const loadData = React.useCallback(async () => {
    try {
      // Load stats
      const { data: statsData } = await supabase.rpc('get_bug_catcher_stats')
      if (statsData && statsData[0]) {
        setStats(statsData[0])
      }

      // Load all actions (admins can see all)
      const { data: actionsData } = await supabase
        .from('bug_actions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (actionsData) {
        setActions(actionsData)
      }

      // Load all bug reports with user info
      const { data: reportsData } = await supabase
        .from('bug_reports')
        .select(`
          *,
          profiles:user_id (display_name)
        `)
        .order('created_at', { ascending: false })
      
      if (reportsData) {
        setBugReports(reportsData.map(r => ({
          ...r,
          user_display_name: r.profiles?.display_name || 'Unknown User'
        })))
      }

    } catch (error) {
      console.error('Error loading bug admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleCreateAction = () => {
    setEditingAction({
      title: '',
      description: '',
      points_reward: 10,
      status: 'draft',
      release_date: null,
      questions: []
    })
    setActionError(null)
    setActionDialogOpen(true)
  }

  const handleEditAction = (action: BugAction) => {
    setEditingAction({ ...action })
    setActionError(null)
    setActionDialogOpen(true)
  }

  const handleSaveAction = async () => {
    if (!editingAction || !user?.id) return
    
    if (!editingAction.title?.trim()) {
      setActionError('Title is required')
      return
    }

    setSavingAction(true)
    setActionError(null)

    try {
      const actionData = {
        title: editingAction.title.trim(),
        description: editingAction.description?.trim() || null,
        points_reward: editingAction.points_reward || 10,
        status: editingAction.status || 'draft',
        release_date: editingAction.release_date || null,
        questions: editingAction.questions || [],
        updated_at: new Date().toISOString()
      }

      if (editingAction.id) {
        // Update existing
        const { error } = await supabase
          .from('bug_actions')
          .update(actionData)
          .eq('id', editingAction.id)
        
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('bug_actions')
          .insert({
            ...actionData,
            created_by: user.id
          })
        
        if (error) throw error
      }

      await loadData()
      setActionDialogOpen(false)
      setEditingAction(null)
    } catch (error: any) {
      setActionError(error?.message || 'Failed to save action')
    } finally {
      setSavingAction(false)
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Are you sure you want to delete this action? This cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('bug_actions')
        .delete()
        .eq('id', actionId)
      
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting action:', error)
    }
  }

  const handleChangeActionStatus = async (actionId: string, newStatus: BugAction['status']) => {
    try {
      const { error } = await supabase
        .from('bug_actions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', actionId)
      
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating action status:', error)
    }
  }

  const handleViewResponses = async (action: BugAction) => {
    setSelectedAction(action)
    
    try {
      const { data } = await supabase
        .from('bug_action_responses')
        .select(`
          *,
          profiles:user_id (display_name)
        `)
        .eq('action_id', action.id)
        .order('completed_at', { ascending: false })
      
      if (data) {
        setViewingResponses(data.map(r => ({
          ...r,
          user_display_name: r.profiles?.display_name || 'Unknown User'
        })))
      }
    } catch (error) {
      console.error('Error loading responses:', error)
      setViewingResponses([])
    }
    
    setResponsesDialogOpen(true)
  }

  const handleViewReport = (report: BugReport) => {
    setSelectedReport(report)
    setAdminNotes(report.admin_notes || '')
    setBonusPoints(15)
    setReportDialogOpen(true)
  }

  const handleCompleteReport = async () => {
    if (!selectedReport || !user?.id) return

    setProcessingReport(true)

    try {
      const { data, error } = await supabase.rpc('admin_complete_bug_report', {
        _report_id: selectedReport.id,
        _admin_id: user.id,
        _bonus_points: bonusPoints,
        _admin_notes: adminNotes.trim() || null
      })

      if (error) throw error

      if (data?.[0]?.success) {
        await loadData()
        setReportDialogOpen(false)
        setSelectedReport(null)
      }
    } catch (error) {
      console.error('Error completing report:', error)
    } finally {
      setProcessingReport(false)
    }
  }

  const handleCloseReport = async () => {
    if (!selectedReport || !user?.id) return

    setProcessingReport(true)

    try {
      const { data, error } = await supabase.rpc('admin_close_bug_report', {
        _report_id: selectedReport.id,
        _admin_id: user.id,
        _admin_notes: adminNotes.trim() || null
      })

      if (error) throw error

      if (data?.[0]?.success) {
        await loadData()
        setReportDialogOpen(false)
        setSelectedReport(null)
      }
    } catch (error) {
      console.error('Error closing report:', error)
    } finally {
      setProcessingReport(false)
    }
  }

  const addQuestion = () => {
    if (!editingAction) return
    const newQuestion = {
      id: `q_${Date.now()}`,
      title: '',
      required: false,
      type: 'text' as const
    }
    setEditingAction({
      ...editingAction,
      questions: [...(editingAction.questions || []), newQuestion]
    })
  }

  const updateQuestion = (index: number, updates: Partial<BugAction['questions'][0]>) => {
    if (!editingAction) return
    const questions = [...(editingAction.questions || [])]
    questions[index] = { ...questions[index], ...updates }
    setEditingAction({ ...editingAction, questions })
  }

  const removeQuestion = (index: number) => {
    if (!editingAction) return
    const questions = [...(editingAction.questions || [])]
    questions.splice(index, 1)
    setEditingAction({ ...editingAction, questions })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Draft</Badge>
      case 'planned':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Planned</Badge>
      case 'active':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</Badge>
      case 'closed':
        return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Closed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</Badge>
      case 'reviewing':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Reviewing</Badge>
      case 'completed':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const glassCard = "rounded-[20px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/92 dark:bg-[#1a1a1d]/92"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Bug className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Bug Catcher Management</h2>
            <p className="text-sm opacity-70">Manage actions, bug reports, and testers</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant={view === 'overview' ? 'default' : 'secondary'}
            className="rounded-xl"
            onClick={() => setView('overview')}
          >
            Overview
          </Button>
          <Button
            variant={view === 'actions' ? 'default' : 'secondary'}
            className="rounded-xl"
            onClick={() => setView('actions')}
          >
            Actions
          </Button>
          <Button
            variant={view === 'reports' ? 'default' : 'secondary'}
            className="rounded-xl"
            onClick={() => setView('reports')}
          >
            Bug Reports
            {stats && stats.pending_bug_reports > 0 && (
              <span className="ml-2 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                {stats.pending_bug_reports}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.total_bug_catchers || 0}</div>
              <div className="text-xs opacity-60">Bug Catchers</div>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.total_actions || 0}</div>
              <div className="text-xs opacity-60">Total Actions</div>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <Play className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.active_actions || 0}</div>
              <div className="text-xs opacity-60">Active Actions</div>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.total_responses || 0}</div>
              <div className="text-xs opacity-60">Completions</div>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <Bug className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.pending_bug_reports || 0}</div>
              <div className="text-xs opacity-60">Pending Reports</div>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardContent className="p-4 text-center">
              <Zap className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <div className="text-2xl font-bold tabular-nums">{stats?.total_points_awarded || 0}</div>
              <div className="text-xs opacity-60">Points Awarded</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions List */}
      {view === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Actions</h3>
            <Button className="rounded-xl" onClick={handleCreateAction}>
              <Plus className="h-4 w-4 mr-2" />
              Create Action
            </Button>
          </div>

          {actions.length === 0 ? (
            <Card className={glassCard}>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm opacity-70">No actions yet. Create your first action!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {actions.map((action) => (
                <Card key={action.id} className={`${glassCard} hover:border-stone-300 dark:hover:border-[#4e4e52] transition`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Target className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{action.title}</span>
                          {getStatusBadge(action.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs opacity-60">
                          <span>{action.points_reward} pts</span>
                          <span>{action.questions?.length || 0} questions</span>
                          <span>{action.completed_count || 0} completed</span>
                          <span>{new Date(action.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg h-8 w-8"
                          onClick={() => handleViewResponses(action)}
                          title="View Responses"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg h-8 w-8"
                          onClick={() => handleEditAction(action)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {action.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg h-8 w-8 text-emerald-600"
                            onClick={() => handleChangeActionStatus(action.id, 'active')}
                            title="Activate"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {action.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg h-8 w-8 text-orange-600"
                            onClick={() => handleChangeActionStatus(action.id, 'closed')}
                            title="Close"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg h-8 w-8 text-red-600"
                          onClick={() => handleDeleteAction(action.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bug Reports List */}
      {view === 'reports' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Bug Reports</h3>

          {bugReports.length === 0 ? (
            <Card className={glassCard}>
              <CardContent className="p-8 text-center">
                <Bug className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm opacity-70">No bug reports yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {bugReports.map((report) => (
                <Card 
                  key={report.id} 
                  className={`${glassCard} hover:border-stone-300 dark:hover:border-[#4e4e52] transition cursor-pointer`}
                  onClick={() => handleViewReport(report)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Bug className={`h-5 w-5 shrink-0 ${
                        report.status === 'pending' ? 'text-yellow-500' :
                        report.status === 'completed' ? 'text-emerald-500' :
                        report.status === 'closed' ? 'text-stone-400' :
                        'text-purple-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{report.bug_name}</span>
                          {getStatusBadge(report.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs opacity-60">
                          <span>by {report.user_display_name}</span>
                          <span>{new Date(report.created_at).toLocaleDateString()}</span>
                          {report.points_earned > 0 && (
                            <span className="text-orange-600">{report.points_earned} pts</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Edit Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAction?.id ? 'Edit Action' : 'Create Action'}
            </DialogTitle>
            <DialogDescription>
              Configure the action details and questions
            </DialogDescription>
          </DialogHeader>

          {editingAction && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm font-medium">Title *</Label>
                <Input
                  value={editingAction.title || ''}
                  onChange={(e) => setEditingAction({ ...editingAction, title: e.target.value })}
                  placeholder="Action title"
                  className="mt-2 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={editingAction.description || ''}
                  onChange={(e) => setEditingAction({ ...editingAction, description: e.target.value })}
                  placeholder="Describe what the tester should do..."
                  rows={3}
                  className="mt-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Points Reward</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingAction.points_reward || 10}
                    onChange={(e) => setEditingAction({ ...editingAction, points_reward: parseInt(e.target.value) || 10 })}
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <select
                    value={editingAction.status || 'draft'}
                    onChange={(e) => setEditingAction({ ...editingAction, status: e.target.value as BugAction['status'] })}
                    className="mt-2 w-full rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {editingAction.status === 'planned' && (
                <div>
                  <Label className="text-sm font-medium">Release Date</Label>
                  <Input
                    type="datetime-local"
                    value={editingAction.release_date?.slice(0, 16) || ''}
                    onChange={(e) => setEditingAction({ ...editingAction, release_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="mt-2 rounded-xl"
                  />
                </div>
              )}

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Questions</Label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-lg"
                    onClick={addQuestion}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Question
                  </Button>
                </div>

                {(editingAction.questions || []).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-stone-200 dark:border-[#3e3e42] text-center text-sm opacity-60">
                    No questions. Actions without questions will just be marked as complete.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(editingAction.questions || []).map((question, index) => (
                      <div key={question.id} className="p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-stone-900/20">
                        <div className="flex items-start gap-2 mb-2">
                          <Input
                            value={question.title}
                            onChange={(e) => updateQuestion(index, { title: e.target.value })}
                            placeholder="Question title"
                            className="rounded-lg text-sm flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="rounded-lg h-9 w-9 text-red-600 shrink-0"
                            onClick={() => removeQuestion(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <select
                            value={question.type}
                            onChange={(e) => updateQuestion(index, { type: e.target.value as 'text' | 'textarea' | 'boolean' })}
                            className="rounded-lg border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1a1a1d] px-2 py-1 text-xs"
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="boolean">Yes/No</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                              className="rounded"
                            />
                            Required
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {actionError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                setActionDialogOpen(false)
                setEditingAction(null)
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSaveAction}
              disabled={savingAction}
            >
              {savingAction ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Responses Dialog */}
      <Dialog open={responsesDialogOpen} onOpenChange={setResponsesDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Responses: {selectedAction?.title}
            </DialogTitle>
            <DialogDescription>
              View all responses from bug catchers
            </DialogDescription>
          </DialogHeader>

          {viewingResponses.length === 0 ? (
            <div className="text-center py-8 opacity-60">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No responses yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {viewingResponses.map((response) => (
                <div key={response.id} className="p-4 rounded-xl border border-stone-200 dark:border-[#3e3e42]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{response.user_display_name}</span>
                    <span className="text-xs opacity-60">
                      {new Date(response.completed_at).toLocaleString()}
                    </span>
                  </div>
                  {response.answers && Object.keys(response.answers).length > 0 ? (
                    <div className="space-y-2 text-sm">
                      {Object.entries(response.answers).map(([key, value]) => (
                        <div key={key} className="bg-stone-50 dark:bg-stone-900/20 p-2 rounded-lg">
                          <div className="text-xs opacity-60 mb-1">{key}</div>
                          <div>{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm opacity-60">No answers (action marked complete)</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => setResponsesDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug Report Detail Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-500" />
              {selectedReport?.bug_name}
            </DialogTitle>
            <DialogDescription>
              Submitted by {selectedReport?.user_display_name} on{' '}
              {selectedReport && new Date(selectedReport.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs opacity-60">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
              </div>

              <div>
                <Label className="text-xs opacity-60">Description</Label>
                <div className="mt-1 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/20 text-sm whitespace-pre-wrap">
                  {selectedReport.description}
                </div>
              </div>

              {selectedReport.steps_to_reproduce && (
                <div>
                  <Label className="text-xs opacity-60">Steps to Reproduce</Label>
                  <div className="mt-1 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/20 text-sm whitespace-pre-wrap">
                    {selectedReport.steps_to_reproduce}
                  </div>
                </div>
              )}

              {selectedReport.user_info && Object.values(selectedReport.user_info).some(v => v) && (
                <div>
                  <Label className="text-xs opacity-60">User Info</Label>
                  <div className="mt-1 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/20 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedReport.user_info.username && <div><span className="opacity-60">Username:</span> {selectedReport.user_info.username}</div>}
                      {selectedReport.user_info.role && <div><span className="opacity-60">Role:</span> {selectedReport.user_info.role}</div>}
                      {selectedReport.user_info.server && <div><span className="opacity-60">Server:</span> {selectedReport.user_info.server}</div>}
                      {selectedReport.user_info.device && <div><span className="opacity-60">Device:</span> {selectedReport.user_info.device}</div>}
                    </div>
                  </div>
                </div>
              )}

              {selectedReport.console_logs && (
                <div>
                  <Label className="text-xs opacity-60">Console Logs</Label>
                  <div className="mt-1 p-3 rounded-xl bg-stone-900 text-stone-100 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                    {selectedReport.console_logs}
                  </div>
                </div>
              )}

              {selectedReport.status === 'pending' || selectedReport.status === 'reviewing' ? (
                <>
                  <div>
                    <Label className="text-sm font-medium">Admin Notes</Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this bug report..."
                      rows={2}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Bonus Points (if completing)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={bonusPoints}
                      onChange={(e) => setBonusPoints(parseInt(e.target.value) || 0)}
                      className="mt-2 rounded-xl w-32"
                    />
                    <p className="text-xs opacity-60 mt-1">
                      User already received {selectedReport.points_earned} pts for submitting
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {selectedReport.admin_notes && (
                    <div>
                      <Label className="text-xs opacity-60">Admin Notes</Label>
                      <div className="mt-1 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/20 text-sm">
                        {selectedReport.admin_notes}
                      </div>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="opacity-60">Total Points Earned:</span>{' '}
                    <span className="font-medium text-orange-600">{selectedReport.points_earned} pts</span>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => setReportDialogOpen(false)}
            >
              Close
            </Button>
            {selectedReport && (selectedReport.status === 'pending' || selectedReport.status === 'reviewing') && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleCloseReport}
                  disabled={processingReport}
                >
                  {processingReport ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Close (Duplicate)
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={handleCompleteReport}
                  disabled={processingReport}
                >
                  {processingReport ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Complete (+{bonusPoints} pts)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminBugsPanel
