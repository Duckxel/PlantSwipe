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
import {
  Bug,
  Trophy,
  Zap,
  Target,
  CheckCircle2,
  Clock,
  ChevronRight,
  Medal,
  AlertCircle,
  Send,
  History,
  ClipboardList,
  Crown,
  Loader2,
  X,
  Check,
  RefreshCw,
  Upload,
  Trash2,
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
  const [consoleLogs, setConsoleLogs] = React.useState('')
  const [submittingReport, setSubmittingReport] = React.useState(false)
  const [reportError, setReportError] = React.useState<string | null>(null)
  const [reportSuccess, setReportSuccess] = React.useState(false)

  // Screenshot upload state
  const [uploadingScreenshot, setUploadingScreenshot] = React.useState(false)
  const [screenshotError, setScreenshotError] = React.useState<string | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const screenshotInputRef = React.useRef<HTMLInputElement | null>(null)

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

      // Get leaderboard (top 5)
      const { data: leaderboardData } = await supabase.rpc('get_bug_catcher_leaderboard', { _limit: 5 })
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

  // Screenshot upload handler
  const handleScreenshotUpload = React.useCallback(async (file: File | null) => {
    if (!file) return
    
    setScreenshotError(null)
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      setScreenshotError('Please upload a valid image file (JPEG, PNG, WebP, GIF, HEIC, AVIF)')
      return
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setScreenshotError('File size must be under 10MB')
      return
    }
    
    // Max 5 screenshots
    if (screenshots.length >= 5) {
      setScreenshotError('Maximum 5 screenshots allowed')
      return
    }
    
    setUploadingScreenshot(true)
    
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      
      if (!token) {
        setScreenshotError('You must be signed in to upload screenshots')
        return
      }
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/bug-report/upload-screenshot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'same-origin'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload screenshot')
      }
      
      if (data.url) {
        setScreenshots(prev => [...prev, data.url])
      }
    } catch (error: any) {
      console.error('Screenshot upload error:', error)
      setScreenshotError(error?.message || 'Failed to upload screenshot')
    } finally {
      setUploadingScreenshot(false)
    }
  }, [screenshots.length])

  const handleScreenshotDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleScreenshotUpload(file)
    }
  }, [handleScreenshotUpload])

  const handleScreenshotBrowse = React.useCallback(() => {
    screenshotInputRef.current?.click()
  }, [])

  const handleScreenshotFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleScreenshotUpload(file)
    }
    // Reset input so the same file can be selected again
    if (e.target) {
      e.target.value = ''
    }
  }, [handleScreenshotUpload])

  const removeScreenshot = React.useCallback((index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }, [])

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
  const heroCard = "relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-orange-100/60 via-white to-amber-100/50 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-[0_35px_60px_-15px_rgba(249,115,22,0.25)]"

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pt-4 md:mt-8 px-3 md:px-4 pb-24 md:pb-16">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin opacity-50" />
        </div>
      </div>
    )
  }

  if (!hasBugCatcherRole) {
    return (
      <div className="max-w-5xl mx-auto pt-4 md:mt-8 px-3 md:px-4 pb-24 md:pb-16">
        <Card className={glassCard}>
          <CardContent className="p-6 md:p-8 text-center">
            <Bug className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-orange-500 opacity-50" />
            <h2 className="text-lg md:text-xl font-semibold mb-2">Bug Catcher Access Required</h2>
            <p className="text-sm opacity-70 mb-4">
              You need the Bug Catcher role to access this page.
            </p>
            <Button onClick={() => navigate('/')} className="rounded-2xl h-11 md:h-9">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pt-4 md:mt-8 px-3 md:px-4 pb-24 md:pb-16 space-y-4 md:space-y-6">
      {/* Mobile-optimized Navigation Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1.5 md:gap-2 bg-stone-100 dark:bg-[#252526] p-1 md:p-1.5 rounded-2xl">
          <Button
            variant={pageView === 'dashboard' ? 'default' : 'ghost'}
            className={`flex-1 rounded-xl h-10 md:h-9 text-sm ${pageView === 'dashboard' ? '' : 'hover:bg-white/50 dark:hover:bg-white/10'}`}
            onClick={() => setPageView('dashboard')}
          >
            <Target className="h-4 w-4 mr-1.5 md:mr-2" />
            <span className="hidden xs:inline">Dashboard</span>
            <span className="xs:hidden">Home</span>
          </Button>
          <Button
            variant={pageView === 'report' ? 'default' : 'ghost'}
            className={`flex-1 rounded-xl h-10 md:h-9 text-sm ${pageView === 'report' ? '' : 'hover:bg-white/50 dark:hover:bg-white/10'}`}
            onClick={() => setPageView('report')}
          >
            <Bug className="h-4 w-4 mr-1.5 md:mr-2" />
            <span className="hidden xs:inline">Report Bug</span>
            <span className="xs:hidden">Report</span>
          </Button>
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-xl h-10 w-10 md:h-9 md:w-9 shrink-0"
          onClick={() => setShowHistory(!showHistory)}
          title="View History"
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-xl h-10 w-10 md:h-9 md:w-9 shrink-0"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {pageView === 'dashboard' && (
        <>
          {/* Hero Card - Points & Rank - Mobile Optimized */}
          <Card className={heroCard}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-6 -right-8 h-32 w-32 rounded-full bg-orange-200/60 dark:bg-orange-500/15 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-amber-100/60 dark:bg-amber-500/10 blur-3xl" />
            </div>
            <CardContent className="relative z-10 p-4 md:p-8">
              {/* Mobile: Compact horizontal layout */}
              <div className="flex items-center gap-3 md:gap-6">
                {/* Bug Icon - Smaller on mobile */}
                <div className="h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shrink-0">
                  <Bug className="h-7 w-7 md:h-10 md:w-10 text-white" />
                </div>
                
                {/* Title - Compact on mobile */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg md:text-3xl font-bold truncate">Bug Catcher HQ</h1>
                  <p className="text-xs md:text-sm opacity-70 hidden md:block">Find bugs, earn points, climb the leaderboard!</p>
                </div>

                {/* Points & Rank - Inline on mobile */}
                <div className="flex gap-2 md:gap-4 shrink-0">
                  <div className="text-center p-2 md:p-4 rounded-xl md:rounded-2xl bg-white/50 dark:bg-black/20 border border-orange-200/50 dark:border-orange-500/20 min-w-[60px] md:min-w-[80px]">
                    <Zap className="h-4 w-4 md:h-6 md:w-6 mx-auto mb-0.5 md:mb-1 text-orange-500" />
                    <div className="text-lg md:text-2xl font-bold tabular-nums">{userPoints}</div>
                    <div className="text-[10px] md:text-xs opacity-60">Points</div>
                  </div>
                  <div className="text-center p-2 md:p-4 rounded-xl md:rounded-2xl bg-white/50 dark:bg-black/20 border border-amber-200/50 dark:border-amber-500/20 min-w-[60px] md:min-w-[80px]">
                    <Trophy className="h-4 w-4 md:h-6 md:w-6 mx-auto mb-0.5 md:mb-1 text-amber-500" />
                    <div className="text-lg md:text-2xl font-bold tabular-nums">
                      {userRank > 0 ? `#${userRank}` : '-'}
                    </div>
                    <div className="text-[10px] md:text-xs opacity-60">Rank</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Stack vertically, Desktop: Side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
            {/* Leaderboard - Mobile Optimized */}
            <Card className={glassCard}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold">Top 5 Bug Catchers</h2>
                </div>
                
                {leaderboard.length === 0 ? (
                  <div className="text-center py-4 opacity-60">
                    <Medal className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs">No rankings yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-2 px-2 md:px-3 py-2 md:py-2.5 rounded-xl transition text-sm active:scale-[0.98] ${
                          entry.user_id === user?.id 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/30' 
                            : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                        }`}
                      >
                        <div className="w-6 flex justify-center shrink-0">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="flex-1 min-w-0 truncate font-medium">
                          {entry.display_name || 'Anonymous'}
                          {entry.user_id === user?.id && (
                            <span className="ml-1 text-[10px] text-orange-600 dark:text-orange-400 font-normal">(You)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 shrink-0 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                          <Zap className="h-3 w-3" />
                          <span className="font-semibold tabular-nums text-xs">{entry.bug_points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Actions - Mobile Optimized with larger touch targets */}
            <Card className={glassCard}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <ClipboardList className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-sm font-semibold">Recommended Actions</h2>
                  <Badge variant="secondary" className="ml-auto text-xs">{availableActions.length}/5</Badge>
                </div>

                {availableActions.length === 0 ? (
                  <div className="text-center py-4 opacity-60">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs">All caught up! Check back later.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 md:space-y-1">
                    {availableActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          setSelectedAction(action)
                          setActionAnswers({})
                          setActionError(null)
                        }}
                        className="w-full flex items-center gap-2 md:gap-3 px-3 py-3 md:py-2.5 rounded-xl border border-stone-200 dark:border-[#3e3e42] hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 active:scale-[0.98] transition text-left group"
                      >
                        <div className="h-8 w-8 md:h-6 md:w-6 rounded-lg md:rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <Target className="h-4 w-4 md:h-4 md:w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0 text-sm font-medium truncate">{action.title}</div>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs shrink-0">
                          +{action.points_reward}
                        </Badge>
                        <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bug Reports Summary - Mobile Optimized */}
          <Card className={glassCard}>
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Bug className="h-5 w-5 text-orange-500" />
                <h2 className="text-base md:text-lg font-semibold">Your Bug Reports</h2>
                <Badge variant="secondary" className="ml-auto">{userBugReports.length}</Badge>
              </div>

              {userBugReports.length === 0 ? (
                <div className="text-center py-6 md:py-8 opacity-60">
                  <Bug className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No bug reports yet. Found a bug? Report it!</p>
                  <Button 
                    variant="secondary" 
                    className="rounded-2xl mt-4 h-11"
                    onClick={() => setPageView('report')}
                  >
                    Report a Bug
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
                  {userBugReports.slice(0, 6).map((report) => (
                    <div
                      key={report.id}
                      className="p-3 md:p-4 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-stone-900/20 active:scale-[0.99] transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
                        <div className="font-medium text-sm md:text-base truncate">{report.bug_name}</div>
                        {getStatusBadge(report.status)}
                      </div>
                      <div className="text-xs opacity-60 mb-2 line-clamp-2">{report.description}</div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-50">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                        {report.points_earned > 0 && (
                          <span className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-0.5">
                            <Zap className="h-3 w-3" />
                            +{report.points_earned}
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
          <CardContent className="p-4 md:p-8">
            {/* Mobile-optimized header */}
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Bug className="h-5 w-5 md:h-6 md:w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-semibold">Report a Bug</h2>
                <p className="text-xs md:text-sm opacity-70 truncate">Help us improve by reporting issues</p>
              </div>
            </div>

            {reportSuccess ? (
              <div className="text-center py-8 md:py-12">
                <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <Check className="h-7 w-7 md:h-8 md:w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">Bug Report Submitted!</h3>
                <p className="text-sm opacity-70">Thanks for helping us squash bugs. You've earned points!</p>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
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

                {/* Screenshots - Drag and Drop Upload */}
                <div>
                  <Label className="text-sm font-medium">Screenshots (Optional)</Label>
                  <p className="text-xs opacity-60 mt-1 mb-2">Upload up to 5 images of the bug ({screenshots.length}/5)</p>
                  
                  {/* Uploaded Screenshots Preview */}
                  {screenshots.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {screenshots.map((url, index) => (
                        <div 
                          key={index} 
                          className="relative group w-24 h-24 rounded-xl overflow-hidden border border-stone-200 dark:border-[#3e3e42] bg-stone-100 dark:bg-stone-800"
                        >
                          <img 
                            src={url} 
                            alt={`Screenshot ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Drop Zone */}
                  {screenshots.length < 5 && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!dragActive) setDragActive(true)
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(false)
                      }}
                      onDrop={handleScreenshotDrop}
                      onClick={handleScreenshotBrowse}
                      className={`
                        mt-2 p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all
                        ${dragActive 
                          ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/20 scale-[1.02]' 
                          : 'border-stone-200 dark:border-[#3e3e42] hover:border-orange-300 dark:hover:border-orange-700'
                        }
                        ${uploadingScreenshot ? 'opacity-70 pointer-events-none' : ''}
                      `}
                    >
                      <input
                        ref={screenshotInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif"
                        hidden
                        onChange={handleScreenshotFileChange}
                        disabled={uploadingScreenshot}
                      />
                      
                      <div className={`
                        mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                        ${dragActive 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                        }
                      `}>
                        {uploadingScreenshot ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Upload className="h-6 w-6" />
                        )}
                      </div>
                      
                      <div className="text-sm font-medium">
                        {dragActive ? (
                          'Drop your image here'
                        ) : uploadingScreenshot ? (
                          'Uploading...'
                        ) : (
                          <>
                            Drag & drop or{' '}
                            <span className="text-orange-600 dark:text-orange-400">browse</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs opacity-50 mt-1">PNG, JPG, WebP, GIF. Max 10MB</p>
                    </div>
                  )}
                  
                  {/* Screenshot Error */}
                  {screenshotError && (
                    <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {screenshotError}
                    </div>
                  )}
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

                {/* Mobile-optimized submit section */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
                  <Button
                    onClick={handleSubmitBugReport}
                    disabled={submittingReport}
                    className="rounded-2xl h-12 md:h-10 flex-1 text-base md:text-sm"
                  >
                    {submittingReport ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Bug Report
                  </Button>
                  <Badge variant="secondary" className="shrink-0 justify-center py-2 md:py-1">
                    +5 pts on submit
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Sheet - Mobile Optimized */}
      {showHistory && (
        <Card className={glassCard}>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-500" />
                <h2 className="text-base md:text-lg font-semibold">Completed Actions</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-xl h-9 w-9"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {completedActions.length === 0 ? (
              <div className="text-center py-6 md:py-8 opacity-60">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No completed actions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 p-3 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-stone-900/20"
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm md:text-base truncate">{action.title}</div>
                        <div className="text-xs opacity-60">
                          {new Date(action.completed_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-7 md:pl-0">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        +{action.points_earned} pts
                      </Badge>
                      {action.action_status !== 'closed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-lg h-8"
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

      {/* Action Dialog - Mobile Optimized */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="rounded-2xl max-w-lg mx-3 md:mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="truncate">{selectedAction?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
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
                        className="mt-2 rounded-xl text-base md:text-sm"
                      />
                    ) : question.type === 'boolean' ? (
                      <div className="flex items-center gap-3 mt-2">
                        <Button
                          type="button"
                          variant={actionAnswers[question.id] === true ? 'default' : 'outline'}
                          className="rounded-xl flex-1 h-11 md:h-9"
                          onClick={() => setActionAnswers(prev => ({ ...prev, [question.id]: true }))}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={actionAnswers[question.id] === false ? 'default' : 'outline'}
                          className="rounded-xl flex-1 h-11 md:h-9"
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
                        className="mt-2 rounded-xl h-11 md:h-9 text-base md:text-sm"
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

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Badge className="sm:mr-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 justify-center py-1.5">
              +{selectedAction?.points_reward || 0} points
            </Badge>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                className="rounded-xl flex-1 sm:flex-none h-11 md:h-9"
                onClick={() => setSelectedAction(null)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl flex-1 sm:flex-none h-11 md:h-9"
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Response Dialog - Mobile Optimized */}
      <Dialog open={!!editingResponse} onOpenChange={(open) => !open && setEditingResponse(null)}>
        <DialogContent className="rounded-2xl max-w-lg mx-3 md:mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="truncate">Edit: {editingResponse?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
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

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="secondary"
              className="rounded-xl h-11 md:h-9 w-full sm:w-auto"
              onClick={() => setEditingResponse(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl h-11 md:h-9 w-full sm:w-auto"
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
