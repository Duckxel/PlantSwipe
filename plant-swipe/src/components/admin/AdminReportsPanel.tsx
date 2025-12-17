import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabaseClient'
import { 
  getReports, 
  getReportsForUser,
  getReport,
  updateReport, 
  addReportNote,
  getReportNotes,
  setUserThreatLevel,
  getUserThreatLevel
} from '@/lib/moderation'
import type { UserReport, UserReportNote, ThreatLevel } from '@/types/moderation'
import { THREAT_LEVEL_LABELS, THREAT_LEVEL_COLORS } from '@/types/moderation'
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  User,
  X,
  ChevronRight,
  Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function AdminReportsPanel() {
  const { t } = useTranslation('common')
  const [reports, setReports] = React.useState<UserReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'review' | 'classified'>('review')
  
  // Selected report for detail view
  const [selectedReport, setSelectedReport] = React.useState<UserReport | null>(null)
  const [reportNotes, setReportNotes] = React.useState<UserReportNote[]>([])
  const [loadingNotes, setLoadingNotes] = React.useState(false)
  const [newNote, setNewNote] = React.useState('')
  const [addingNote, setAddingNote] = React.useState(false)
  
  // User reports modal (all reports for a user)
  const [userReportsUserId, setUserReportsUserId] = React.useState<string | null>(null)
  const [userReports, setUserReports] = React.useState<UserReport[]>([])
  const [loadingUserReports, setLoadingUserReports] = React.useState(false)
  
  // Threat level dialog
  const [threatLevelDialogOpen, setThreatLevelDialogOpen] = React.useState(false)
  const [threatLevelUserId, setThreatLevelUserId] = React.useState<string | null>(null)
  const [threatLevelUserName, setThreatLevelUserName] = React.useState<string | null>(null)
  const [currentThreatLevel, setCurrentThreatLevel] = React.useState<ThreatLevel>(0)
  const [newThreatLevel, setNewThreatLevel] = React.useState<ThreatLevel>(0)
  const [settingThreatLevel, setSettingThreatLevel] = React.useState(false)

  // Load reports
  const loadReports = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getReports({
        status: filter === 'all' ? undefined : filter,
        limit: 100
      })
      setReports(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    loadReports()
  }, [loadReports])

  // Load notes for selected report
  const loadNotes = React.useCallback(async (reportId: string) => {
    setLoadingNotes(true)
    try {
      const notes = await getReportNotes(reportId)
      setReportNotes(notes)
    } catch (e) {
      console.error('Failed to load notes:', e)
    } finally {
      setLoadingNotes(false)
    }
  }, [])

  // Handle select report
  const handleSelectReport = React.useCallback(async (report: UserReport) => {
    setSelectedReport(report)
    setReportNotes([])
    await loadNotes(report.id)
  }, [loadNotes])

  // Handle add note
  const handleAddNote = React.useCallback(async () => {
    if (!selectedReport || !newNote.trim()) return
    setAddingNote(true)
    try {
      await addReportNote({ reportId: selectedReport.id, note: newNote.trim() })
      setNewNote('')
      await loadNotes(selectedReport.id)
    } catch (e) {
      console.error('Failed to add note:', e)
    } finally {
      setAddingNote(false)
    }
  }, [selectedReport, newNote, loadNotes])

  // Handle classify report
  const handleClassify = React.useCallback(async (reportId: string) => {
    try {
      await updateReport(reportId, { status: 'classified' })
      await loadReports()
      if (selectedReport?.id === reportId) {
        const updated = await getReport(reportId)
        setSelectedReport(updated)
      }
    } catch (e) {
      console.error('Failed to classify report:', e)
    }
  }, [loadReports, selectedReport])

  // Load all reports for a user
  const handleViewUserReports = React.useCallback(async (userId: string) => {
    setUserReportsUserId(userId)
    setLoadingUserReports(true)
    try {
      const data = await getReportsForUser(userId)
      setUserReports(data)
    } catch (e) {
      console.error('Failed to load user reports:', e)
    } finally {
      setLoadingUserReports(false)
    }
  }, [])

  // Open threat level dialog
  const handleOpenThreatLevelDialog = React.useCallback(async (userId: string, userName: string | null) => {
    setThreatLevelUserId(userId)
    setThreatLevelUserName(userName)
    try {
      const level = await getUserThreatLevel(userId)
      setCurrentThreatLevel(level)
      setNewThreatLevel(level)
    } catch (e) {
      console.error('Failed to get threat level:', e)
    }
    setThreatLevelDialogOpen(true)
  }, [])

  // Handle set threat level
  const handleSetThreatLevel = React.useCallback(async () => {
    if (!threatLevelUserId) return
    setSettingThreatLevel(true)
    try {
      await setUserThreatLevel(threatLevelUserId, newThreatLevel)
      setThreatLevelDialogOpen(false)
      // Refresh reports to show updated threat level
      await loadReports()
    } catch (e) {
      console.error('Failed to set threat level:', e)
    } finally {
      setSettingThreatLevel(false)
    }
  }, [threatLevelUserId, newThreatLevel, loadReports])

  const reviewCount = reports.filter(r => r.status === 'review').length
  const classifiedCount = reports.filter(r => r.status === 'classified').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('moderation.admin.reports')}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {t('moderation.admin.reportsDescription')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={loadReports}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-700 pb-2">
        <button
          className={cn(
            "px-4 py-2 rounded-t-lg text-sm font-medium transition-colors",
            filter === 'review' 
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-b-2 border-amber-500" 
              : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          )}
          onClick={() => setFilter('review')}
        >
          {t('moderation.admin.reviewStatus')} ({reviewCount})
        </button>
        <button
          className={cn(
            "px-4 py-2 rounded-t-lg text-sm font-medium transition-colors",
            filter === 'classified' 
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-500" 
              : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          )}
          onClick={() => setFilter('classified')}
        >
          {t('moderation.admin.classifiedStatus')} ({classifiedCount})
        </button>
        <button
          className={cn(
            "px-4 py-2 rounded-t-lg text-sm font-medium transition-colors",
            filter === 'all' 
              ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-b-2 border-stone-500" 
              : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          )}
          onClick={() => setFilter('all')}
        >
          {t('moderation.admin.allReports')} ({reports.length})
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400">
            {t('moderation.admin.noReports')}
          </p>
        </div>
      )}

      {/* Reports grid */}
      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Reports list */}
          <div className="space-y-3">
            {reports.map(report => (
              <Card 
                key={report.id} 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md rounded-xl",
                  selectedReport?.id === report.id && "ring-2 ring-emerald-500"
                )}
                onClick={() => handleSelectReport(report)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Reported user avatar */}
                      {report.reportedUser?.avatarUrl ? (
                        <img 
                          src={report.reportedUser.avatarUrl} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-stone-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {report.reportedUser?.displayName || 'Unknown'}
                          </span>
                          {/* Threat level badge */}
                          {report.reportedUser && (
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", THREAT_LEVEL_COLORS[report.reportedUser.threatLevel])}
                            >
                              {THREAT_LEVEL_LABELS[report.reportedUser.threatLevel]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {t('moderation.admin.reportedBy')} {report.reporter?.displayName || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={report.status === 'review' ? 'default' : 'secondary'} className="text-xs">
                        {report.status === 'review' ? (
                          <Clock className="h-3 w-3 mr-1" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {report.status === 'review' ? t('moderation.admin.reviewStatus') : t('moderation.admin.classifiedStatus')}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </div>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400 mt-3 line-clamp-2">
                    {report.reason}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Report detail */}
          <div className="lg:sticky lg:top-4">
            {selectedReport ? (
              <Card className="rounded-xl">
                <CardContent className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {selectedReport.reportedUser?.avatarUrl ? (
                        <img 
                          src={selectedReport.reportedUser.avatarUrl} 
                          alt="" 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                          <User className="h-6 w-6 text-stone-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">
                          {selectedReport.reportedUser?.displayName || 'Unknown'}
                        </h3>
                        {selectedReport.reportedUser && (
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs mt-1", THREAT_LEVEL_COLORS[selectedReport.reportedUser.threatLevel])}
                          >
                            {THREAT_LEVEL_LABELS[selectedReport.reportedUser.threatLevel]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg"
                      onClick={() => setSelectedReport(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/admin/members?search=${encodeURIComponent(selectedReport.reportedUser?.displayName || '')}`}>
                      <Button variant="outline" size="sm" className="rounded-lg">
                        <Eye className="h-4 w-4 mr-2" />
                        {t('moderation.admin.viewUser')}
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg"
                      onClick={() => handleViewUserReports(selectedReport.reportedUserId)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {t('moderation.admin.allFilesForUser')}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-lg"
                      onClick={() => handleOpenThreatLevelDialog(
                        selectedReport.reportedUserId, 
                        selectedReport.reportedUser?.displayName || null
                      )}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {t('moderation.admin.setThreatLevel')}
                    </Button>
                    {selectedReport.status === 'review' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleClassify(selectedReport.id)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {t('moderation.admin.classify')}
                      </Button>
                    )}
                  </div>

                  {/* Report details */}
                  <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-700">
                    <div>
                      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                        {t('moderation.admin.reportReason')}
                      </label>
                      <p className="mt-1 text-sm">{selectedReport.reason}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-stone-500 dark:text-stone-400">
                      <div>
                        <span className="font-medium">{t('moderation.admin.reportedBy')}</span>{' '}
                        {selectedReport.reporter?.displayName || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">{t('moderation.admin.reportedAt')}</span>{' '}
                        {new Date(selectedReport.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {selectedReport.classifiedBy && (
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-medium">{t('moderation.admin.classifiedBy')}</span>{' '}
                        {selectedReport.classifier?.displayName || 'Admin'}
                        {' '}{t('moderation.admin.classifiedAt')}{' '}
                        {selectedReport.classifiedAt ? new Date(selectedReport.classifiedAt).toLocaleDateString() : ''}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {t('moderation.admin.reportNotes')}
                    </h4>
                    
                    {loadingNotes ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {reportNotes.length === 0 ? (
                          <p className="text-xs text-stone-400 italic">No notes yet</p>
                        ) : (
                          reportNotes.map(note => (
                            <div key={note.id} className="p-2 rounded-lg bg-stone-50 dark:bg-stone-800/50 text-sm">
                              <p>{note.note}</p>
                              <p className="text-xs text-stone-400 mt-1">
                                {note.admin?.displayName || 'Admin'} - {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Add note */}
                    <div className="flex gap-2 mt-3">
                      <Input
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={t('moderation.admin.notePlaceholder')}
                        className="text-sm rounded-lg"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                      />
                      <Button
                        variant="default"
                        size="sm"
                        className="rounded-lg"
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || addingNote}
                      >
                        {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : t('moderation.admin.addNote')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-64 text-stone-400">
                <div className="text-center">
                  <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Select a report to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Reports Dialog */}
      <Dialog open={!!userReportsUserId} onOpenChange={() => setUserReportsUserId(null)}>
        <DialogContent className="max-w-lg rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{t('moderation.admin.allFilesForUser')}</DialogTitle>
          </DialogHeader>
          {loadingUserReports ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : userReports.length === 0 ? (
            <p className="text-center py-8 text-stone-500">No reports found</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {userReports.map(report => (
                <div key={report.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={report.status === 'review' ? 'default' : 'secondary'} className="text-xs">
                      {report.status}
                    </Badge>
                    <span className="text-xs text-stone-500">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm">{report.reason}</p>
                  <p className="text-xs text-stone-400 mt-1">
                    {t('moderation.admin.reportedBy')} {report.reporter?.displayName || 'Unknown'}
                  </p>
                </div>
              ))}
              <p className="text-xs text-stone-400 text-center pt-2">
                {t('moderation.admin.totalReports')}: {userReports.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Threat Level Dialog */}
      <Dialog open={threatLevelDialogOpen} onOpenChange={setThreatLevelDialogOpen}>
        <DialogContent className="max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('moderation.admin.setThreatLevel')}
            </DialogTitle>
            {threatLevelUserName && (
              <DialogDescription>{threatLevelUserName}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3 py-4">
            {([0, 1, 2, 3] as ThreatLevel[]).map(level => (
              <button
                key={level}
                className={cn(
                  "w-full p-3 rounded-xl border-2 transition-all text-left",
                  newThreatLevel === level 
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" 
                    : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
                )}
                onClick={() => setNewThreatLevel(level)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn("text-xs", THREAT_LEVEL_COLORS[level])}>
                      {level}
                    </Badge>
                    <span className="font-medium">{THREAT_LEVEL_LABELS[level]}</span>
                  </div>
                  {newThreatLevel === level && (
                    <Check className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1 ml-9">
                  {level === 0 && t('moderation.threatLevel.safeDescription')}
                  {level === 1 && t('moderation.threatLevel.susDescription')}
                  {level === 2 && t('moderation.threatLevel.dangerDescription')}
                  {level === 3 && t('moderation.threatLevel.bannedDescription')}
                </p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setThreatLevelDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetThreatLevel}
              disabled={settingThreatLevel || newThreatLevel === currentThreatLevel}
              className={newThreatLevel === 3 ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {settingThreatLevel ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : newThreatLevel === 3 ? (
                <Ban className="h-4 w-4 mr-2" />
              ) : null}
              {newThreatLevel === 3 ? t('moderation.admin.banUser') : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
