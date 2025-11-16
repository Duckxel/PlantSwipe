// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TaskType } from '@/types/garden'
import { createPatternTask, logGardenActivity, resyncTaskOccurrencesForGarden, refreshGardenTaskCache } from '@/lib/gardens'
import { broadcastGardenUpdate } from '@/lib/realtime'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from 'react-i18next'

type Period = 'week' | 'month' | 'year'

export function TaskCreateDialog({
  open,
  onOpenChange,
  gardenId,
  gardenPlantId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gardenId: string
  gardenPlantId: string
  onCreated?: () => Promise<void> | void
}) {
  const { user } = useAuth()
  const { t } = useTranslation('common')
  const [type, setType] = React.useState<TaskType>('water')
  const [customName, setCustomName] = React.useState('')
  const [emoji, setEmoji] = React.useState<string>('')
  const [period, setPeriod] = React.useState<Period>('week')
  const [amount, setAmount] = React.useState<number>(1)

  // Inline schedule selection state
  const [weeklyDays, setWeeklyDays] = React.useState<number[]>([])
  const [monthlyNthWeekdays, setMonthlyNthWeekdays] = React.useState<string[]>([])
  const [yearlyDays, setYearlyDays] = React.useState<string[]>([])

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      // Reset to defaults on open
      setType('water')
      setCustomName('')
      setEmoji('')
      setPeriod('week')
      setAmount(1)
      setWeeklyDays([])
      setMonthlyNthWeekdays([])
      setYearlyDays([])
      setError(null)
    }
  }, [open])

  const maxForPeriod = (p: Period) => (p === 'week' ? 7 : p === 'month' ? 12 : 52)
  const countSelected = period === 'week' ? weeklyDays.length : period === 'month' ? monthlyNthWeekdays.length : yearlyDays.length
  const remaining = Math.max(0, amount - countSelected)
  const disabledMore = remaining === 0

  const handleAmountChange = (n: number) => {
    const max = maxForPeriod(period)
    const next = Math.max(1, Math.min(n, max))
    setAmount(next)
    // Trim selections if too many
    if (period === 'week') setWeeklyDays((cur) => cur.slice(0, next))
    if (period === 'month') setMonthlyNthWeekdays((cur) => cur.slice(0, next))
    if (period === 'year') setYearlyDays((cur) => cur.slice(0, next))
  }

  const save = async () => {
    if (!gardenId || !gardenPlantId || saving) return
    setError(null)
    if (countSelected !== amount) {
      const unit = period === 'week' ? t('gardenDashboard.taskDialog.daysPerWeek') : period === 'month' ? t('gardenDashboard.taskDialog.daysPerMonth') : t('gardenDashboard.taskDialog.timesPerYear')
      setError(t('gardenDashboard.taskDialog.selectExactly', { amount, period: unit }))
      return
    }
    setSaving(true)
    try {
      // Create task - this is the critical operation
      await createPatternTask({
        gardenId,
        gardenPlantId,
        type,
        customName: type === 'custom' ? (customName || null) : null,
        emoji: type === 'custom' ? (emoji.trim() || null) : null,
        period,
        amount,
        weeklyDays: period === 'week' ? [...weeklyDays].sort((a, b) => a - b) : null,
        monthlyDays: period === 'month' ? [] : null,
        yearlyDays: period === 'year' ? [...yearlyDays].sort() : null,
        monthlyNthWeekdays: period === 'month' ? [...monthlyNthWeekdays].sort() : null,
      })
      
      // Close dialog immediately for better UX
      onOpenChange(false)
      
      // Fire and forget - don't block UI
      const taskTypeLabel = type === 'custom' ? (customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${type}`)
      
      // Broadcast immediately (non-blocking)
      broadcastGardenUpdate({ gardenId, kind: 'tasks', metadata: { action: 'create', gardenPlantId }, actorId: user?.id ?? null }).catch((err) => {
        console.warn('[TaskCreateDialog] Failed to broadcast task update:', err)
      })
      
      // Resync, refresh cache, and log activity in background using requestIdleCallback
      const backgroundTasks = () => {
        // Resync in background - don't block
        const now = new Date()
        const startIso = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
        const endIso = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString()
        resyncTaskOccurrencesForGarden(gardenId, startIso, endIso).then(() => {
          // Refresh cache after resync
          refreshGardenTaskCache(gardenId).catch(() => {})
        }).catch(() => {})
        
        // Log activity (non-blocking)
        logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.addedTask', { taskName: taskTypeLabel }), taskName: taskTypeLabel, actorColor: null }).catch(() => {})
        
        // Call onCreated callback
        if (onCreated) {
          Promise.resolve(onCreated()).catch(() => {})
        }
      }
      
      // Use requestIdleCallback to avoid blocking UI
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(backgroundTasks, { timeout: 1000 })
      } else {
        setTimeout(backgroundTasks, 100)
      }
    } catch (e: any) {
      setError(e?.message || t('gardenDashboard.taskDialog.failedToCreate'))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-2xl max-w-3xl"
        onOpenAutoFocus={(e) => { e.preventDefault() }}
        onPointerDownOutside={(e) => { e.preventDefault() }}
        onInteractOutside={(e) => { e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>{t('gardenDashboard.taskDialog.createTask')}</DialogTitle>
          <DialogDescription>{t('gardenDashboard.taskDialog.createTaskDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="flex h-9 w-full rounded-md border border-input dark:border-[#3e3e42] bg-transparent dark:bg-[#2d2d30] px-3 py-1 text-base shadow-sm md:text-sm capitalize text-black dark:text-white"
              value={type}
              onChange={(e: any) => setType(e.target.value)}
            >
              {(['water','fertilize','harvest','cut','custom'] as TaskType[]).map(v => (
                <option key={v} value={v} className="capitalize">{t(`garden.taskTypes.${v}`)}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                value={String(amount)}
                onChange={(e: any) => handleAmountChange(Number(e.target.value || '1'))}
              />
              <select
                className="flex h-9 w-full rounded-md border border-input dark:border-[#3e3e42] bg-transparent dark:bg-[#2d2d30] px-3 py-1 text-base shadow-sm md:text-sm capitalize text-black dark:text-white"
                value={period}
                onChange={(e: any) => {
                  const p = e.target.value as Period
                  setPeriod(p)
                  // reset picks when period changes
                  setWeeklyDays([])
                  setMonthlyNthWeekdays([])
                  setYearlyDays([])
                  handleAmountChange(amount)
                }}
              >
                {(['week','month','year'] as Period[]).map(p => (
                  <option key={p} value={p} className="capitalize">{t(`gardenDashboard.taskDialog.${p}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {type === 'custom' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('gardenDashboard.taskDialog.customTaskName')}</label>
              <Input value={customName} onChange={(e: any) => setCustomName(e.target.value)} placeholder={t('gardenDashboard.taskDialog.customTaskNamePlaceholder')} />
            </div>
          )}

          {type === 'custom' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('gardenDashboard.taskDialog.emoji')}</label>
              <div className="flex items-center gap-2">
                <Input value={emoji} onChange={(e: any) => setEmoji(e.target.value)} placeholder={t('gardenDashboard.taskDialog.emojiPlaceholder')} maxLength={4} />
                <div className="text-sm opacity-60">{t('gardenDashboard.taskDialog.optional')}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['💧','🍽️','🌾','✂️','🧴','🧪','🧹','🪴','📌','✅'].map(em => (
                  <button key={em} type="button" onClick={() => setEmoji(em)} className={`h-9 w-9 rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] ${emoji === em ? 'ring-2 ring-black dark:ring-white' : ''}`}>{em}</button>
                ))}
              </div>
            </div>
          )}

          

          <div className="text-sm opacity-60">
            {period === 'week' && t('gardenDashboard.taskDialog.pickDaysWeek')}
            {period === 'month' && t('gardenDashboard.taskDialog.pickDaysMonth')}
            {period === 'year' && t('gardenDashboard.taskDialog.pickDaysYear')}
          </div>

          {period === 'week' && (
            <WeekPicker
              selectedNumbers={weeklyDays}
              onToggleNumber={(uiIdx) => {
                const map = [1,2,3,4,5,6,0]
                const dayNumber = map[uiIdx]
                setWeeklyDays((cur) => {
                  const has = cur.includes(dayNumber)
                  if (has) return cur.filter((x) => x !== dayNumber)
                  if (disabledMore) return cur
                  return [...cur, dayNumber]
                })
              }}
              disabledMore={disabledMore}
            />
          )}
          {period === 'month' && (
            <>
              <div className="text-xs opacity-70">{t('gardenDashboard.taskDialog.pickWeeksExample')}</div>
              <MonthNthWeekdayPicker
                selected={monthlyNthWeekdays}
                onToggle={(weekIndex, uiIndex) => {
                  const map = [1,2,3,4,5,6,0]
                  const weekday = map[uiIndex]
                  const key = `${weekIndex}-${weekday}`
                  setMonthlyNthWeekdays((cur) => {
                    const has = cur.includes(key)
                    if (has) return cur.filter((x) => x !== key)
                    if (disabledMore) return cur
                    return [...cur, key]
                  })
                }}
                onToggleHeader={(uiIndex) => {
                  const map = [1,2,3,4,5,6,0]
                  const weekday = map[uiIndex]
                  const keys = [1,2,3,4].map(w => `${w}-${weekday}`)
                  setMonthlyNthWeekdays((cur) => {
                    const allSelected = keys.every(k => cur.includes(k))
                    if (allSelected) return cur.filter(k => !keys.includes(k))
                    const result = [...cur]
                    for (const k of keys) {
                      if (result.includes(k)) continue
                      if (result.length >= amount) break
                      if (disabledMore) break
                      result.push(k)
                    }
                    return result
                  })
                }}
                disabledMore={disabledMore}
              />
            </>
          )}
          {period === 'year' && (
            <YearMonthNthWeekdayPicker
              selected={yearlyDays}
              onToggle={(monthIdx, weekIndex, uiIndex) => {
                const map = [1,2,3,4,5,6,0]
                const weekday = map[uiIndex]
                const mm = String(monthIdx + 1).padStart(2, '0')
                const key = `${mm}-${weekIndex}-${weekday}`
                setYearlyDays((cur) => {
                  const has = cur.includes(key)
                  if (has) return cur.filter((x) => x !== key)
                  if (disabledMore) return cur
                  return [...cur, key]
                })
              }}
              onToggleHeader={(monthIdx, uiIndex) => {
                const map = [1,2,3,4,5,6,0]
                const weekday = map[uiIndex]
                const mm = String(monthIdx + 1).padStart(2, '0')
                const keys = [1,2,3,4].map(w => `${mm}-${w}-${weekday}`)
                setYearlyDays((cur) => {
                  const allSelected = keys.every(k => cur.includes(k))
                  if (allSelected) return cur.filter(k => !keys.includes(k))
                  const result = [...cur]
                  for (const k of keys) {
                    if (result.includes(k)) continue
                    if (result.length >= amount) break
                    if (disabledMore) break
                    result.push(k)
                  }
                  return result
                })
              }}
              disabledMore={disabledMore}
            />
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={saving}>{t('gardenDashboard.taskDialog.close')}</Button>
            <Button className="rounded-2xl" onClick={save} disabled={saving || countSelected !== amount}>{saving ? t('gardenDashboard.taskDialog.creating') : t('gardenDashboard.taskDialog.createTaskButton')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WeekPicker({ selectedNumbers, onToggleNumber, disabledMore }: { selectedNumbers: number[]; onToggleNumber: (uiIndex: number) => void; disabledMore: boolean }) {
  const { t } = useTranslation('common')
  const display = [
    { label: t('gardenDashboard.taskDialog.dayLabels.mon'), uiIndex: 0 },
    { label: t('gardenDashboard.taskDialog.dayLabels.tue'), uiIndex: 1 },
    { label: t('gardenDashboard.taskDialog.dayLabels.wed'), uiIndex: 2 },
    { label: t('gardenDashboard.taskDialog.dayLabels.thu'), uiIndex: 3 },
    { label: t('gardenDashboard.taskDialog.dayLabels.fri'), uiIndex: 4 },
    { label: t('gardenDashboard.taskDialog.dayLabels.sat'), uiIndex: 5 },
    { label: t('gardenDashboard.taskDialog.dayLabels.sun'), uiIndex: 6 },
  ]
  const mondayFirstMap = [1,2,3,4,5,6,0]
  return (
    <div className="grid grid-cols-7 gap-2">
      {display.map(({ label, uiIndex }) => {
        const dayNumber = mondayFirstMap[uiIndex]
        const isOn = selectedNumbers.includes(dayNumber)
        return (
          <button
            key={uiIndex}
            type="button"
            onClick={() => onToggleNumber(uiIndex)}
            className={`h-12 rounded-xl border border-stone-300 dark:border-[#3e3e42] text-sm ${isOn ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] text-black dark:text-white'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!isOn && disabledMore}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MonthNthWeekdayPicker({ selected, onToggle, onToggleHeader, disabledMore }: { selected: string[]; onToggle: (weekIndex: number, uiIndex: number) => void; onToggleHeader: (uiIndex: number) => void; disabledMore: boolean }) {
  const { t } = useTranslation('common')
  const labels = [
    t('gardenDashboard.taskDialog.dayLabels.mon'),
    t('gardenDashboard.taskDialog.dayLabels.tue'),
    t('gardenDashboard.taskDialog.dayLabels.wed'),
    t('gardenDashboard.taskDialog.dayLabels.thu'),
    t('gardenDashboard.taskDialog.dayLabels.fri'),
    t('gardenDashboard.taskDialog.dayLabels.sat'),
    t('gardenDashboard.taskDialog.dayLabels.sun')
  ]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
        <div className="text-xs opacity-70 text-center">{t('gardenDashboard.taskDialog.weekLabel')}</div>
        {labels.map((l, uiIndex) => (
          <button
            key={l}
            type="button"
            onClick={() => onToggleHeader(uiIndex)}
            className={`h-8 rounded-lg border border-stone-300 dark:border-[#3e3e42] text-[11px] bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] text-black dark:text-white`}
          >
            {l}
          </button>
        ))}
      </div>
      {[1,2,3,4].map((wk, rowIdx) => (
        <div key={wk} className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
          <div className="text-xs opacity-70 text-center">{wk}</div>
          {labels.map((_, uiIndex) => {
            const weekday = [1,2,3,4,5,6,0][uiIndex]
            const key = `${rowIdx + 1}-${weekday}`
            const isOn = selected.includes(key)
            return (
              <button
                key={uiIndex}
                type="button"
                onClick={() => onToggle(rowIdx + 1, uiIndex)}
                className={`h-10 rounded-xl border border-stone-300 dark:border-[#3e3e42] text-sm ${isOn ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] text-black dark:text-white'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={!isOn && disabledMore}
                aria-label={`${wk} ${labels[uiIndex]}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function YearMonthNthWeekdayPicker({ selected, onToggle, onToggleHeader, disabledMore }: { selected: string[]; onToggle: (monthIdx: number, weekIndex: number, uiIndex: number) => void; onToggleHeader: (monthIdx: number, uiIndex: number) => void; disabledMore: boolean }) {
  const { t } = useTranslation('common')
  const months = [
    t('gardenDashboard.taskDialog.monthNames.jan'),
    t('gardenDashboard.taskDialog.monthNames.feb'),
    t('gardenDashboard.taskDialog.monthNames.mar'),
    t('gardenDashboard.taskDialog.monthNames.apr'),
    t('gardenDashboard.taskDialog.monthNames.may'),
    t('gardenDashboard.taskDialog.monthNames.jun'),
    t('gardenDashboard.taskDialog.monthNames.jul'),
    t('gardenDashboard.taskDialog.monthNames.aug'),
    t('gardenDashboard.taskDialog.monthNames.sep'),
    t('gardenDashboard.taskDialog.monthNames.oct'),
    t('gardenDashboard.taskDialog.monthNames.nov'),
    t('gardenDashboard.taskDialog.monthNames.dec')
  ]
  const labels = [
    t('gardenDashboard.taskDialog.dayLabels.mon'),
    t('gardenDashboard.taskDialog.dayLabels.tue'),
    t('gardenDashboard.taskDialog.dayLabels.wed'),
    t('gardenDashboard.taskDialog.dayLabels.thu'),
    t('gardenDashboard.taskDialog.dayLabels.fri'),
    t('gardenDashboard.taskDialog.dayLabels.sat'),
    t('gardenDashboard.taskDialog.dayLabels.sun')
  ]
  const weekNames = ['1st','2nd','3rd','4th']
  const mondayFirstMap = [1,2,3,4,5,6,0]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[60vh] overflow-auto pr-1">
      {months.map((label, monthIdx) => (
        <div key={label} className="rounded-xl border border-stone-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-2">
          <div className="text-xs opacity-70 mb-2">{label}</div>
          <div className="space-y-2">
            <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
              <div className="text-xs opacity-70 text-center">{t('gardenDashboard.taskDialog.weekLabel')}</div>
              {labels.map((l, uiIndex) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onToggleHeader(monthIdx, uiIndex)}
                  className={`h-8 rounded-lg border border-stone-300 dark:border-[#3e3e42] text-[11px] bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] text-black dark:text-white`}
                >
                  {l}
                </button>
              ))}
            </div>
            {weekNames.map((wn, rowIdx) => (
              <div key={wn} className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
                <div className="text-xs opacity-70 text-center">{rowIdx + 1}</div>
                {labels.map((_, uiIndex) => {
                  const weekday = mondayFirstMap[uiIndex]
                  const mm = String(monthIdx + 1).padStart(2, '0')
                  const key = `${mm}-${rowIdx + 1}-${weekday}`
                  const isOn = selected.includes(key)
                  return (
                    <button
                      key={uiIndex}
                      type="button"
                      onClick={() => onToggle(monthIdx, rowIdx + 1, uiIndex)}
                      className={`h-10 rounded-xl border border-stone-300 dark:border-[#3e3e42] text-sm ${isOn ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] text-black dark:text-white'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
                      disabled={!isOn && disabledMore}
                      aria-label={`${label} ${wn} ${labels[uiIndex]}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
