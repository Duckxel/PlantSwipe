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
import { Minus, Plus } from 'lucide-react'

type Period = 'week' | 'month' | 'year'

// Shared constants
const MONDAY_FIRST_MAP = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_TO_UI: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

const TASK_TYPES: Array<{ type: TaskType; emoji: string }> = [
  { type: 'water', emoji: '💧' },
  { type: 'fertilize', emoji: '🍽️' },
  { type: 'harvest', emoji: '🌾' },
  { type: 'cut', emoji: '✂️' },
  { type: 'custom', emoji: '✨' },
]

const CUSTOM_EMOJI_PRESETS = ['🧴', '🧪', '🧹', '🪴', '📌', '🌸', '🐛', '🪱', '☀️', '🌡️']

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
      setType('water')
      setCustomName('')
      setEmoji('')
      setPeriod('week')
      setAmount(1)
      setWeeklyDays([])
      setMonthlyNthWeekdays([])
      setYearlyDays([])
      setSaving(false)
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
    if (period === 'week') setWeeklyDays((cur) => cur.slice(0, next))
    if (period === 'month') setMonthlyNthWeekdays((cur) => cur.slice(0, next))
    if (period === 'year') setYearlyDays((cur) => cur.slice(0, next))
  }

  const handlePeriodChange = (p: Period) => {
    if (p === period) return
    setPeriod(p)
    setWeeklyDays([])
    setMonthlyNthWeekdays([])
    setYearlyDays([])
    setAmount(Math.max(1, Math.min(amount, maxForPeriod(p))))
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

      setSaving(false)
      onOpenChange(false)

      const taskTypeLabel = type === 'custom' ? (customName || t('garden.taskTypes.custom')) : t(`garden.taskTypes.${type}`)
      broadcastGardenUpdate({ gardenId, kind: 'tasks', metadata: { action: 'create', gardenPlantId }, actorId: user?.id ?? null }).catch(() => {})

      const backgroundTasks = () => {
        const now = new Date()
        const startIso = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
        const endIso = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString()
        resyncTaskOccurrencesForGarden(gardenId, startIso, endIso).then(() => {
          refreshGardenTaskCache(gardenId).catch(() => {})
        }).catch(() => {})
        logGardenActivity({ gardenId, kind: 'note' as any, message: t('gardenDashboard.taskDialog.addedTask', { taskName: taskTypeLabel }), taskName: taskTypeLabel, actorColor: null }).catch(() => {})
        if (onCreated) Promise.resolve(onCreated()).catch(() => {})
      }

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

  const dayLabels = [
    t('gardenDashboard.taskDialog.dayLabels.mon', 'Mon'),
    t('gardenDashboard.taskDialog.dayLabels.tue', 'Tue'),
    t('gardenDashboard.taskDialog.dayLabels.wed', 'Wed'),
    t('gardenDashboard.taskDialog.dayLabels.thu', 'Thu'),
    t('gardenDashboard.taskDialog.dayLabels.fri', 'Fri'),
    t('gardenDashboard.taskDialog.dayLabels.sat', 'Sat'),
    t('gardenDashboard.taskDialog.dayLabels.sun', 'Sun'),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-2xl max-w-lg p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('gardenDashboard.taskDialog.createTask', 'New Task')}</DialogTitle>
            <DialogDescription>{t('gardenDashboard.taskDialog.createTaskDescription', 'Set up a recurring task for your plant')}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* ── Step 1: Task Type ── */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 block">
              {t('gardenDashboard.taskDialog.taskType', 'Task Type')}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {TASK_TYPES.map(({ type: tt, emoji: em }) => {
                const isOn = type === tt
                return (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setType(tt)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-center ${
                      isOn
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600'
                    }`}
                  >
                    <span className="text-xl">{em}</span>
                    <span className={`text-[11px] font-medium leading-tight ${isOn ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-600 dark:text-stone-400'}`}>
                      {t(`garden.taskTypes.${tt}`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom task options */}
          {type === 'custom' && (
            <div className="space-y-3 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-1 block">
                  {t('gardenDashboard.taskDialog.customTaskName', 'Task Name')}
                </label>
                <Input
                  value={customName}
                  onChange={(e: any) => setCustomName(e.target.value)}
                  placeholder={t('gardenDashboard.taskDialog.customTaskNamePlaceholder', 'e.g. Repot, Mist leaves...')}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5 block">
                  {t('gardenDashboard.taskDialog.emoji', 'Emoji')}
                  <span className="opacity-50 ml-1">({t('gardenDashboard.taskDialog.optional', 'optional')})</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {CUSTOM_EMOJI_PRESETS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(emoji === em ? '' : em)}
                      className={`h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition-all ${
                        emoji === em
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 scale-110'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:scale-105'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Frequency ── */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 block">
              {t('gardenDashboard.taskDialog.frequency', 'How Often?')}
            </label>
            <div className="flex items-center gap-3">
              {/* Amount stepper */}
              <div className="flex items-center gap-0 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleAmountChange(amount - 1)}
                  disabled={amount <= 1}
                  className="h-10 w-10 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-bold text-lg tabular-nums">{amount}</span>
                <button
                  type="button"
                  onClick={() => handleAmountChange(amount + 1)}
                  disabled={amount >= maxForPeriod(period)}
                  className="h-10 w-10 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm text-stone-500 dark:text-stone-400">
                {t('gardenDashboard.taskDialog.timesPer', 'times per')}
              </span>

              {/* Period toggle */}
              <div className="flex rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                {(['week', 'month', 'year'] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodChange(p)}
                    className={`h-10 px-4 text-sm font-medium capitalize transition-all ${
                      period === p
                        ? 'bg-emerald-600 text-white'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
                    }`}
                  >
                    {t(`gardenDashboard.taskDialog.${p}`, p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Step 3: Day Picker ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                {t('gardenDashboard.taskDialog.pickSchedule', 'Pick Your Days')}
              </label>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                countSelected === amount
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}>
                {countSelected} / {amount}
              </span>
            </div>

            {/* Weekly picker */}
            {period === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {dayLabels.map((label, uiIndex) => {
                  const dayNumber = MONDAY_FIRST_MAP[uiIndex]
                  const isOn = weeklyDays.includes(dayNumber)
                  return (
                    <button
                      key={uiIndex}
                      type="button"
                      onClick={() => {
                        setWeeklyDays((cur) => {
                          if (cur.includes(dayNumber)) return cur.filter((x) => x !== dayNumber)
                          if (disabledMore) return cur
                          return [...cur, dayNumber]
                        })
                      }}
                      className={`h-12 rounded-xl border-2 text-sm font-medium transition-all ${
                        isOn
                          ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 text-stone-700 dark:text-stone-300'
                      } ${!isOn && disabledMore ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={!isOn && disabledMore}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Monthly picker */}
            {period === 'month' && (
              <div className="space-y-1.5">
                <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                  {t('gardenDashboard.taskDialog.pickWeeksExample', 'Pick week & day. E.g. 1st Mon.')}
                </div>
                {/* Header */}
                <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                  <div />
                  {dayLabels.map((l) => (
                    <div key={l} className="text-[10px] text-center font-medium text-stone-400 dark:text-stone-500">{l}</div>
                  ))}
                </div>
                {/* Rows */}
                {['1st', '2nd', '3rd', '4th'].map((wn, rowIdx) => (
                  <div key={wn} className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                    <div className="text-xs text-stone-400 dark:text-stone-500 text-center font-medium">{wn}</div>
                    {dayLabels.map((dl, uiIndex) => {
                      const weekday = MONDAY_FIRST_MAP[uiIndex]
                      const key = `${rowIdx + 1}-${weekday}`
                      const isOn = monthlyNthWeekdays.includes(key)
                      return (
                        <button
                          key={uiIndex}
                          type="button"
                          onClick={() => {
                            setMonthlyNthWeekdays((cur) => {
                              if (cur.includes(key)) return cur.filter((x) => x !== key)
                              if (disabledMore) return cur
                              return [...cur, key]
                            })
                          }}
                          className={`h-10 rounded-xl border-2 text-[11px] font-medium transition-all ${
                            isOn
                              ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                              : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600'
                          } ${!isOn && disabledMore ? 'opacity-40 cursor-not-allowed' : ''}`}
                          disabled={!isOn && disabledMore}
                          aria-label={`${wn} ${dl}`}
                        >
                          {isOn ? dl.slice(0, 2) : ''}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Yearly picker */}
            {period === 'year' && (
              <YearlyPickerInline
                selected={yearlyDays}
                onToggle={(key) => {
                  setYearlyDays((cur) => {
                    if (cur.includes(key)) return cur.filter((x) => x !== key)
                    if (disabledMore) return cur
                    return [...cur, key]
                  })
                }}
                onRemove={(key) => setYearlyDays((cur) => cur.filter((x) => x !== key))}
                disabledMore={disabledMore}
                amount={amount}
                t={t}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('gardenDashboard.taskDialog.close', 'Cancel')}
            </Button>
            <Button
              className="flex-1 rounded-xl gap-2"
              onClick={save}
              disabled={saving || countSelected !== amount}
            >
              {saving
                ? t('gardenDashboard.taskDialog.creating', 'Creating...')
                : t('gardenDashboard.taskDialog.createTaskButton', 'Create Task')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Yearly Picker (inline version matching the redesigned SchedulePickerDialog) ── */

function YearlyPickerInline({ selected, onToggle, onRemove, disabledMore, amount, t }: {
  selected: string[]
  onToggle: (key: string) => void
  onRemove: (key: string) => void
  disabledMore: boolean
  amount: number
  t: ReturnType<typeof useTranslation<'common'>>['t']
}) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekLabels = ['1st', '2nd', '3rd', '4th']
  const weekdayToUI: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }
  const [activeMonth, setActiveMonth] = React.useState<number | null>(null)

  const countByMonth = React.useMemo(() => {
    const counts: Record<number, number> = {}
    for (const key of selected) {
      const mm = parseInt(key.split('-')[0], 10)
      if (mm >= 1 && mm <= 12) counts[mm] = (counts[mm] || 0) + 1
    }
    return counts
  }, [selected])

  const formatKey = (key: string) => {
    const [mm, wi, wd] = key.split('-').map(Number)
    return `${months[mm - 1]} · ${weekLabels[wi - 1]} ${dayLabels[weekdayToUI[wd] ?? 0]}`
  }

  return (
    <div className="space-y-3">
      {/* Summary chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...selected].sort().map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-xs font-medium"
            >
              {formatKey(key)}
              <button type="button" onClick={() => onRemove(key)} className="ml-0.5 hover:text-red-600 dark:hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {months.map((label, idx) => {
          const count = countByMonth[idx + 1] || 0
          const isActive = activeMonth === idx
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMonth(isActive ? null : idx)}
              className={`relative h-10 rounded-xl border-2 text-xs font-medium transition-all ${
                isActive
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 text-stone-700 dark:text-stone-300'
              }`}
            >
              {label}
              {count > 0 && !isActive && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Weekday picker for active month */}
      {activeMonth !== null && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-3 space-y-1.5">
          <div className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{months[activeMonth]}</div>
          <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-1 items-center">
            <div />
            {dayLabels.map((l) => (
              <div key={l} className="text-[9px] text-center font-medium text-stone-400">{l}</div>
            ))}
          </div>
          {weekLabels.map((wn, rowIdx) => (
            <div key={wn} className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-1 items-center">
              <div className="text-[10px] text-stone-400 text-center">{wn}</div>
              {dayLabels.map((dl, uiIndex) => {
                const weekday = MONDAY_FIRST_MAP[uiIndex]
                const mm = String(activeMonth + 1).padStart(2, '0')
                const key = `${mm}-${rowIdx + 1}-${weekday}`
                const isOn = selected.includes(key)
                return (
                  <button
                    key={uiIndex}
                    type="button"
                    onClick={() => onToggle(key)}
                    className={`h-9 rounded-lg border-2 text-[10px] font-medium transition-all ${
                      isOn
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600'
                    } ${!isOn && disabledMore ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!isOn && disabledMore}
                  >
                    {isOn ? dl.slice(0, 2) : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
