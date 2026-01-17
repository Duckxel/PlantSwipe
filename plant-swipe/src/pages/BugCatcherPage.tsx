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
import { checkBugCatcherAccess } from "@/constants/userRoles"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import {
  Bug,
  Trophy,
  Zap,
  Target,
  CheckCircle2,
  Clock,
  ChevronRight,
  Star,
  Medal,
  Flame,
  AlertCircle,
  Send,
  History,
  ClipboardList,
  Crown,
  Loader2,
  ImagePlus,
  X,
  Check,
  RefreshCw,
} from "lucide-react"

type LeaderboardEntry = {
  rank: number
  user_id: string
  display_name: string | null
  avatar_url: string | null
  bug_points: number
  actions_completed: number
}

type BugAction = {
  id: string
  title: string
  description: string | null
  points_reward: number
  questions: Array<{
    id: string
    title: string
    required: boolean
    type: 'text' | 'textarea' | 'boolean'
  }>
  created_at: string
}

type CompletedAction = {
  id: string
  action_id: string
  title: string
  description: string | null
  points_earned: number
  answers: Record<string, string | boolean>
  completed_at: string
  action_status: string
}

type BugReport = {
  id: string
  bug_name: string
  description: string
  status: string
  points_earned: number
  created_at: string
  resolved_at: string | null
}

type PageView = 'dashboard' | 'report'

export function BugCatcherPage() {
  const navigate = useLanguageNavigate()
  const { user, profile } = useAuth()
  const { t } = useTranslation('common')

  const [loading, setLoading] = React.useState(true)
  const [pageView, setPageView] = React.useState<PageView>('dashboard')
  const [userPoints, setUserPoints] = React.useState(0)
  const [userRank, setUserRank] = React.useState(0)
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([])
  const [availableActions, setAvailableActions] = React.useState<BugAction[]>([])
  const [completedActions, setCompletedActions] = React.useState<CompletedAction[]>([])
  const [userBugReports, setUserBugReports] = React.useState<BugReport[]>([])
  const [showHistory, setShowHistory] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)

  // Action dialog state
  const [selectedAction, setSelectedAction] = React.useState<BugAction | null>(null)
  const [actionAnswers, setActionAnswers] = React.useState<Record<string, string | boolean>>({})
  const [submittingAction, setSubmittingAction] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  // Edit response dialog state
  const [editingResponse, setEditingResponse] = React.useState<CompletedAction | null>(null)
  const [editAnswers, setEditAnswers] = React.useState<Record<string, string | boolean>>({})
  const [savingEdit, setSavingEdit] = React.useState(false)

  // Bug report form state
  const [bugName, setBugName] = React.useState('')
  const [bugDescription, setBugDescription] = React.useState('')
  const [stepsToReproduce, setStepsToReproduce] = React.useState('')
  const [screenshots, setScreenshots] = React.useState<string[]>([])
  const [userInfo, setUserInfo] = React.useState({ username: '', role: '', server: '', device: '' })
  const [consoleLogs, setConsoleLogs] = React.useState('')
  const [submittingReport, setSubmittingReport] = React.useState(false)
  const [reportError, setReportError] = React.useState<string | null>(null)
  const [reportSuccess, setReportSuccess] = React.useState(false)

  // Check if user has bug_catcher role
  const hasBugCatcherRole = React.useMemo(() => {
    return checkBugCatcherAccess(profile)
  }, [profile])

  // Redirect if not bug catcher
  React.useEffect(() => {
    if (!loading && !hasBugCatcherRole) {
      navigate('/')
    }
  }, [loading, hasBugCatcherRole, navigate])

  // Load data
  const loadData = React.useCallback(async () => {
    if (!user?.id) return
    
    try {
      // Get user points from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('bug_points')
        .eq('id', user.id)
        .single()
      
      if (profileData) {
        setUserPoints(profileData.bug_points || 0)
      }

      // Get user rank
      const { data: rankData } = await supabase.rpc('get_bug_catcher_rank', { _user_id: user.id })
      if (rankData) {
        setUserRank(rankData)
      }

      // Get leaderboard
      const { data: leaderboardData } = await supabase.rpc('get_bug_catcher_leaderboard', { _limit: 10 })
      if (leaderboardData) {
        setLeaderboard(leaderboardData)
      }

      // Get available actions (max 5)
      const { data: actionsData } = await supabase.rpc('get_available_bug_actions', { 
        _user_id: user.id, 
        _limit: 5 
      })
      if (actionsData) {
        setAvailableActions(actionsData)
      }

      // Get completed actions
      const { data: completedData } = await supabase.rpc('get_completed_bug_actions', { _user_id: user.id })
      if (completedData) {
        setCompletedActions(completedData)
      }

      // Get user's bug reports
      const { data: reportsData } = await supabase.rpc('get_user_bug_reports', { _user_id: user.id })
      if (reportsData) {
        setUserBugReports(reportsData)
      }

    } catch (error) {
      console.error('Error loading bug catcher data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    if (user?.id && hasBugCatcherRole) {
      loadData()
    } else if (!user) {
      setLoading(false)
    }
  }, [user?.id, hasBugCatcherRole, loadData])

  // Pre-fill user info from profile
  React.useEffect(() => {
    if (profile) {
      setUserInfo(prev => ({
        ...prev,
        username: profile.display_name || '',
        role: profile.roles?.join(', ') || 'member'
      }))
    }
  }, [profile])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleSubmitAction = async () => {
    if (!selectedAction || !user?.id) return
    
    // Validate required questions
    for (const question of selectedAction.questions) {
      if (question.required) {
        const answer = actionAnswers[question.id]
        if (answer === undefined || answer === '' || answer === null) {
          setActionError(`Please answer: ${question.title}`)
          return
        }
      }
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { data, error } = await supabase.rpc('submit_bug_action_response', {
        _user_id: user.id,
        _action_id: selectedAction.id,
        _answers: actionAnswers
      })

      if (error) throw error

      if (data && data[0]?.success) {
        // Refresh data
        await loadData()
        setSelectedAction(null)
        setActionAnswers({})
      } else {
        setActionError(data?.[0]?.message || 'Failed to submit action')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Failed to submit action')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleUpdateResponse = async () => {
    if (!editingResponse || !user?.id) return

    setSavingEdit(true)

    try {
      const { data, error } = await supabase.rpc('update_bug_action_response', {
        _user_id: user.id,
        _response_id: editingResponse.id,
        _answers: editAnswers
      })

      if (error) throw error

      if (data && data[0]?.success) {
        await loadData()
        setEditingResponse(null)
        setEditAnswers({})
      }
    } catch (error) {
      console.error('Error updating response:', error)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSubmitBugReport = async () => {
    if (!user?.id) return

    // Validate required fields
    if (!bugName.trim()) {
      setReportError('Bug name is required')
      return
    }
    if (!bugDescription.trim()) {
      setReportError('Bug description is required')
      return
    }

    setSubmittingReport(true)
    setReportError(null)

    try {
      const { data, error } = await supabase.rpc('submit_bug_report', {
        _user_id: user.id,
        _bug_name: bugName.trim(),
        _description: bugDescription.trim(),
        _steps_to_reproduce: stepsToReproduce.trim() || null,
        _screenshots: screenshots,
        _user_info: userInfo,
        _console_logs: consoleLogs.trim() || null
      })

      if (error) throw error

      if (data && data[0]?.success) {
        setReportSuccess(true)
        // Reset form
        setBugName('')
        setBugDescription('')
        setStepsToReproduce('')
        setScreenshots([])
        setConsoleLogs('')
        // Refresh data
        await loadData()
        // Show success for 2 seconds then go back to dashboard
        setTimeout(() => {
          setReportSuccess(false)
          setPageView('dashboard')
        }, 2000)
      } else {
        setReportError(data?.[0]?.message || 'Failed to submit bug report')
      }
    } catch (error: any) {
      setReportError(error?.message || 'Failed to submit bug report')
    } finally {
      setSubmittingReport(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
    return <span className="text-sm font-medium opacity-60">#{rank}</span>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</Badge>
      case 'reviewing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Reviewing</Badge>
      case 'completed':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Completed</Badge>
      case 'closed':
        return <Badge variant="secondary" className="bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Closed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const glassCard = "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.65)]"
  const heroCard = "relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-[0_35px_60px_-15px_rgba(249,115,22,0.25)]"

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin opacity-50" />
        </div>
      </div>
    )
  }

  if (!hasBugCatcherRole) {
    return (
      <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16">
        <Card className={glassCard}>
          <CardContent className="p-8 text-center">
            <Bug className="h-12 w-12 mx-auto mb-4 text-orange-500 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Bug Catcher Access Required</h2>
            <p className="text-sm opacity-70 mb-4">
              You need the Bug Catcher role to access this page.
            </p>
            <Button onClick={() => navigate('/')} className="rounded-2xl">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={pageView === 'dashboard' ? 'default' : 'secondary'}
          className="rounded-2xl"
          onClick={() => setPageView('dashboard')}
        >
          <Target className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <Button
          variant={pageView === 'report' ? 'default' : 'secondary'}
          className="rounded-2xl"
          onClick={() => setPageView('report')}
        >
          <Bug className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl"
          onClick={() => setShowHistory(!showHistory)}
          title="View History"
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {pageView === 'dashboard' && (
        <>
          {/* Hero Card - Points & Rank */}
          <Card className={heroCard}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-6 -right-8 h-32 w-32 rounded-full bg-orange-200/60 dark:bg-orange-500/15 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-amber-100/60 dark:bg-amber-500/10 blur-3xl" />
            </div>
            <CardContent className="relative z-10 p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Bug Icon */}
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
                  <Bug className="h-10 w-10 text-white" />
                </div>
                
                {/* Stats */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-2xl md:text-3xl font-bold mb-1">Bug Catcher HQ</h1>
                  <p className="text-sm opacity-70">Find bugs, earn points, climb the leaderboard!</p>
                </div>

                {/* Points & Rank Cards */}
                <div className="flex gap-4">
                  <div className="text-center p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-orange-200/50 dark:border-orange-500/20">
                    <Zap className="h-6 w-6 mx-auto mb-1 text-orange-500" />
                    <div className="text-2xl font-bold tabular-nums">{userPoints}</div>
                    <div className="text-xs opacity-60">Bug Points</div>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-amber-200/50 dark:border-amber-500/20">
                    <Trophy className="h-6 w-6 mx-auto mb-1 text-amber-500" />
                    <div className="text-2xl font-bold tabular-nums">
                      {userRank > 0 ? `#${userRank}` : '-'}
                    </div>
                    <div className="text-xs opacity-60">Your Rank</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leaderboard */}
            <Card className={glassCard}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold">Top Bug Catchers</h2>
                </div>
                
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 opacity-60">
                    <Medal className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No rankings yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition ${
                          entry.user_id === user?.id 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700' 
                            : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                        }`}
                      >
                        <div className="w-8 flex justify-center">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {entry.display_name || 'Anonymous'}
                            {entry.user_id === user?.id && (
                              <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">(You)</span>
                            )}
                          </div>
                          <div className="text-xs opacity-60">{entry.actions_completed} actions</div>
                        </div>
                        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <Zap className="h-4 w-4" />
                          <span className="font-semibold tabular-nums">{entry.bug_points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Actions */}
            <Card className={glassCard}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold">Recommended Actions</h2>
                  <Badge variant="secondary" className="ml-auto">{availableActions.length}/5</Badge>
                </div>

                {availableActions.length === 0 ? (
                  <div className="text-center py-8 opacity-60">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm">All caught up! Check back later for more tasks.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          setSelectedAction(action)
                          setActionAnswers({})
                          setActionError(null)
                        }}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-stone-200 dark:border-[#3e3e42] hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition text-left group"
                      >
                        <Target className="h-5 w-5 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{action.title}</div>
                          {action.description && (
                            <div className="text-xs opacity-60 truncate">{action.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            +{action.points_reward} pts
                          </Badge>
                          <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bug Reports Summary */}
          <Card className={glassCard}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bug className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold">Your Bug Reports</h2>
                <Badge variant="secondary" className="ml-auto">{userBugReports.length}</Badge>
              </div>

              {userBugReports.length === 0 ? (
                <div className="text-center py-8 opacity-60">
                  <Bug className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No bug reports yet. Found a bug? Report it!</p>
                  <Button 
                    variant="secondary" 
                    className="rounded-2xl mt-4"
                    onClick={() => setPageView('report')}
                  >
                    Report a Bug
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {userBugReports.slice(0, 6).map((report) => (
                    <div
                      key={report.id}
                      className="p-4 rounded-xl border border-stone-200 dark:border-[#3e3e42]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-medium truncate">{report.bug_name}</div>
                        {getStatusBadge(report.status)}
                      </div>
                      <div className="text-xs opacity-60 mb-2 line-clamp-2">{report.description}</div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-50">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                        {report.points_earned > 0 && (
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            +{report.points_earned} pts
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {pageView === 'report' && (
        <Card className={glassCard}>
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Bug className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Report a Bug</h2>
                <p className="text-sm opacity-70">Help us improve by reporting issues you find</p>
              </div>
            </div>

            {reportSuccess ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Bug Report Submitted!</h3>
                <p className="text-sm opacity-70">Thanks for helping us squash bugs. You've earned points!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Bug Name */}
                <div>
                  <Label htmlFor="bug-name" className="text-sm font-medium">
                    Bug Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bug-name"
                    value={bugName}
                    onChange={(e) => setBugName(e.target.value)}
                    placeholder="e.g., Button doesn't respond on mobile"
                    className="mt-2 rounded-xl"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="bug-description" className="text-sm font-medium">
                    Bug Description <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs opacity-60 mt-1 mb-2">What is happening?</p>
                  <Textarea
                    id="bug-description"
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Describe the bug in detail..."
                    rows={4}
                    className="rounded-xl"
                  />
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <Label htmlFor="steps-reproduce" className="text-sm font-medium">
                    How to Reproduce
                  </Label>
                  <p className="text-xs opacity-60 mt-1 mb-2">List of steps taken to recreate the bug</p>
                  <Textarea
                    id="steps-reproduce"
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                    rows={4}
                    className="rounded-xl"
                  />
                </div>

                {/* Screenshots - Placeholder for future implementation */}
                <div>
                  <Label className="text-sm font-medium">Screenshots (Optional)</Label>
                  <div className="mt-2 p-4 border-2 border-dashed border-stone-200 dark:border-[#3e3e42] rounded-xl text-center">
                    <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm opacity-60">Screenshot upload coming soon</p>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-4 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-stone-900/20">
                  <Label className="text-sm font-medium">Your Info (Optional)</Label>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label htmlFor="info-username" className="text-xs opacity-60">Username</Label>
                      <Input
                        id="info-username"
                        value={userInfo.username}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Your username"
                        className="mt-1 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="info-role" className="text-xs opacity-60">Role</Label>
                      <Input
                        id="info-role"
                        value={userInfo.role}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, role: e.target.value }))}
                        placeholder="Your role"
                        className="mt-1 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="info-server" className="text-xs opacity-60">Server</Label>
                      <Input
                        id="info-server"
                        value={userInfo.server}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, server: e.target.value }))}
                        placeholder="e.g., EU, US"
                        className="mt-1 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="info-device" className="text-xs opacity-60">Device</Label>
                      <Input
                        id="info-device"
                        value={userInfo.device}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, device: e.target.value }))}
                        placeholder="e.g., iPhone 14, Chrome"
                        className="mt-1 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Console Logs */}
                <div>
                  <Label htmlFor="console-logs" className="text-sm font-medium">
                    Console Logs (Optional)
                  </Label>
                  <p className="text-xs opacity-60 mt-1 mb-2">What the Console displays [Ctrl + Shift + I]</p>
                  <Textarea
                    id="console-logs"
                    value={consoleLogs}
                    onChange={(e) => setConsoleLogs(e.target.value)}
                    placeholder="Paste any error messages from the browser console..."
                    rows={3}
                    className="rounded-xl font-mono text-xs"
                  />
                </div>

                {reportError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {reportError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSubmitBugReport}
                    disabled={submittingReport}
                    className="rounded-2xl flex-1"
                  >
                    {submittingReport ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Bug Report
                  </Button>
                  <Badge variant="secondary" className="shrink-0">
                    +5 pts on submit
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Sheet */}
      {showHistory && (
        <Card className={glassCard}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Completed Actions</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-xl"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {completedActions.length === 0 ? (
              <div className="text-center py-8 opacity-60">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No completed actions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42]"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{action.title}</div>
                      <div className="text-xs opacity-60">
                        {new Date(action.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        +{action.points_earned} pts
                      </Badge>
                      {action.action_status !== 'closed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => {
                            setEditingResponse(action)
                            setEditAnswers(action.answers || {})
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              {selectedAction?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.description || 'Complete this action to earn points'}
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4 py-2">
              {selectedAction.questions.length > 0 ? (
                selectedAction.questions.map((question) => (
                  <div key={question.id}>
                    <Label className="text-sm font-medium">
                      {question.title}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {question.type === 'textarea' ? (
                      <Textarea
                        value={(actionAnswers[question.id] as string) || ''}
                        onChange={(e) => setActionAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="Your answer..."
                        rows={3}
                        className="mt-2 rounded-xl"
                      />
                    ) : question.type === 'boolean' ? (
                      <div className="flex items-center gap-4 mt-2">
                        <Button
                          type="button"
                          variant={actionAnswers[question.id] === true ? 'default' : 'outline'}
                          className="rounded-xl"
                          onClick={() => setActionAnswers(prev => ({ ...prev, [question.id]: true }))}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={actionAnswers[question.id] === false ? 'default' : 'outline'}
                          className="rounded-xl"
                          onClick={() => setActionAnswers(prev => ({ ...prev, [question.id]: false }))}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Input
                        value={(actionAnswers[question.id] as string) || ''}
                        onChange={(e) => setActionAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="Your answer..."
                        className="mt-2 rounded-xl"
                      />
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500 opacity-50" />
                  <p className="text-sm opacity-70">Mark this action as complete to earn points</p>
                </div>
              )}

              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {actionError}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Badge className="mr-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              +{selectedAction?.points_reward || 0} points
            </Badge>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => setSelectedAction(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSubmitAction}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Response Dialog */}
      <Dialog open={!!editingResponse} onOpenChange={(open) => !open && setEditingResponse(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Edit Response: {editingResponse?.title}
            </DialogTitle>
            <DialogDescription>
              Update your answers (only available while action is active)
            </DialogDescription>
          </DialogHeader>

          {editingResponse && (
            <div className="space-y-4 py-2">
              {/* Note: We'd need to fetch the original questions here in a real implementation */}
              <div className="text-sm opacity-70">
                <p>Your previous answers have been loaded. Make any changes needed.</p>
              </div>
              
              {/* For simplicity, show raw JSON editor - in production would show proper form */}
              <Textarea
                value={JSON.stringify(editAnswers, null, 2)}
                onChange={(e) => {
                  try {
                    setEditAnswers(JSON.parse(e.target.value))
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={6}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => setEditingResponse(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleUpdateResponse}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BugCatcherPage
