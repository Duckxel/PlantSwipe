import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Loader2,
  RefreshCw,
  Check,
  X,
  Sprout,
  Clock,
  Flag,
  User,
  Leaf,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { useLanguageNavigate } from '@/lib/i18nRouting'

interface PlantReport {
  id: string
  userId: string
  plantId: string
  note: string
  imageUrl: string | null
  createdAt: string
  plantName: string
  plantImage: string | null
  userName: string
}

export function AdminPlantReportsPanel() {
  const navigate = useLanguageNavigate()
  const [reports, setReports] = React.useState<PlantReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [detailReport, setDetailReport] = React.useState<PlantReport | null>(null)

  const loadReports = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/plant-reports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load reports')
      setReports(data.reports || [])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load reports'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleComplete = React.useCallback(async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setProcessingId(reportId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`/api/admin/plant-reports/${reportId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to complete report')

      setReports(prev => prev.filter(r => r.id !== reportId))
      if (detailReport?.id === reportId) setDetailReport(null)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to complete report'
      setError(message)
    } finally {
      setProcessingId(null)
    }
  }, [detailReport])

  const handleReject = React.useCallback(async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setProcessingId(reportId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`/api/admin/plant-reports/${reportId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reject report')

      setReports(prev => prev.filter(r => r.id !== reportId))
      if (detailReport?.id === reportId) setDetailReport(null)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to reject report'
      setError(message)
    } finally {
      setProcessingId(null)
    }
  }, [detailReport])

  const handleRowClick = React.useCallback((report: PlantReport) => {
    navigate(`/plants/${report.plantId}/edit`)
  }, [navigate])

  const handleNoteClick = React.useCallback((report: PlantReport, e: React.MouseEvent) => {
    e.stopPropagation()
    setDetailReport(report)
  }, [])

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 30) return `${diffD}d ago`
    return date.toLocaleDateString()
  }

  const truncateNote = (note: string, max = 60) => {
    if (note.length <= max) return note
    return note.slice(0, max).trimEnd() + '...'
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Flag className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              Plant Information Reports
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              User-submitted reports about incorrect or outdated plant information
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
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading reports...</span>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
            <Flag className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="text-base font-semibold text-stone-900 dark:text-white mb-1">No reports</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 text-center max-w-sm">
            No plant information reports have been submitted yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl sm:rounded-2xl border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] overflow-hidden">
          <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
            {reports.map((report) => (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(report)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleRowClick(report)
                  }
                }}
                className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 cursor-pointer transition-all hover:bg-stone-50 dark:hover:bg-[#252528]"
              >
                {/* Plant Image */}
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-[#2d2d30] dark:to-[#252528] flex items-center justify-center">
                  {report.plantImage ? (
                    <img
                      src={report.plantImage}
                      alt={report.plantName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <Sprout className="h-6 w-6 text-stone-400" />
                  )}
                </div>

                {/* Report Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900 dark:text-white text-sm sm:text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {report.plantName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 max-w-[240px] sm:max-w-[360px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30 text-xs text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-300 dark:hover:border-amber-600/50 transition-all text-left group/note"
                      onClick={(e) => handleNoteClick(report, e)}
                      title="Click to read full note"
                    >
                      <MessageSquare className="h-3 w-3 flex-shrink-0 opacity-60 group-hover/note:opacity-100 transition-opacity" />
                      <span className="truncate">{truncateNote(report.note)}</span>
                    </button>
                    <span className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(report.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8 px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    onClick={(e) => handleComplete(report.id, e)}
                    disabled={processingId === report.id}
                    title="Mark as complete (adds user as contributor)"
                  >
                    {processingId === report.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8 px-2.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={(e) => handleReject(report.id, e)}
                    disabled={processingId === report.id}
                    title="Reject and delete report"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Detail Dialog */}
      <Dialog open={!!detailReport} onOpenChange={() => setDetailReport(null)}>
        <DialogContent className="max-w-lg rounded-[28px] max-h-[90vh] overflow-y-auto">
          {detailReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-amber-500" />
                  Plant Report Details
                </DialogTitle>
                <DialogDescription>
                  Report about {detailReport.plantName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* User Info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30">
                  <div className="h-10 w-10 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-stone-900 dark:text-white">
                      {detailReport.userName}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {new Date(detailReport.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Plant Info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30">
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
                    {detailReport.plantImage ? (
                      <img src={detailReport.plantImage} alt={detailReport.plantName} className="h-full w-full object-cover" />
                    ) : (
                      <Leaf className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                    )}
                  </div>
                  <div className="font-medium text-sm text-stone-900 dark:text-white">
                    {detailReport.plantName}
                  </div>
                </div>

                {/* Full Note */}
                <div>
                  <label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Report Note
                  </label>
                  <div className="mt-1.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30 text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                    {detailReport.note}
                  </div>
                </div>

                {/* Report Image */}
                {detailReport.imageUrl && (
                  <div>
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Attached Image
                    </label>
                    <div className="mt-1.5">
                      <img
                        src={detailReport.imageUrl}
                        alt="Report attachment"
                        className="max-w-full rounded-xl border border-stone-200 dark:border-[#3e3e42]"
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      handleComplete(detailReport.id, e)
                    }}
                    disabled={processingId === detailReport.id}
                  >
                    {processingId === detailReport.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      handleReject(detailReport.id, e)
                    }}
                    disabled={processingId === detailReport.id}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
