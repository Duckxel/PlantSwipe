/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'

type Period = 'week' | 'month' | 'year'

export interface ScheduleSelection {
  weeklyDays?: number[]
  monthlyDays?: number[]
  yearlyDays?: string[]
  monthlyNthWeekdays?: string[]
}

export function SchedulePickerDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: Period
  amount: number
  onSave: (selection: ScheduleSelection) => Promise<void>
  initialSelection?: ScheduleSelection
  onChangePeriod?: (p: Period) => void
  onChangeAmount?: (n: number) => void
  lockToYear?: boolean
  allowedPeriods?: Period[]
  modal?: boolean
}) {
  const { open, onOpenChange, period, amount, onSave, initialSelection, onChangePeriod, onChangeAmount, lockToYear, allowedPeriods, modal = true } = props

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [weeklyDays, setWeeklyDays] = React.useState<number[]>([])
  const [_monthlyDays, setMonthlyDays] = React.useState<number[]>([])
  const [yearlyDays, setYearlyDays] = React.useState<string[]>([])
  const [monthlyNthWeekdays, setMonthlyNthWeekdays] = React.useState<string[]>([])

  React.useEffect(() => {
    // Reset selection on open
    if (open) {
      setWeeklyDays(initialSelection?.weeklyDays ? [...initialSelection.weeklyDays] : [])
      setMonthlyDays(initialSelection?.monthlyDays ? [...initialSelection.monthlyDays] : [])
      // Convert legacy MM-DD yearly picks to MM-weekIndex-weekday (1..4, 0=Sun..6=Sat)
      if (initialSelection?.yearlyDays && initialSelection.yearlyDays.length > 0) {
        const out: string[] = []
        for (const v of initialSelection.yearlyDays) {
          if (typeof v !== 'string') continue
          const parts = v.split('-')
          if (parts.length === 2) {
            const [mm, dd] = parts
            const m = Math.max(1, Math.min(12, Number(mm)))
            const d = Math.max(1, Math.min(31, Number(dd)))
            const sampleYear = 2024 // leap-year safe for Feb 29 display
            const dt = new Date(Date.UTC(sampleYear, m - 1, d))
            if (!isNaN(dt.getTime())) {
              const weekday = dt.getUTCDay() // 0=Sun..6=Sat
              const weekIndexRaw = Math.floor((d - 1) / 7) + 1 // 1..5
              const weekIndex = Math.max(1, Math.min(4, weekIndexRaw)) // clamp to 1..4
              const mmStr = String(m).padStart(2, '0')
              out.push(`${mmStr}-${weekIndex}-${weekday}`)
            }
          } else if (parts.length === 3) {
            out.push(v)
          }
        }
        setYearlyDays(out)
      } else {
        setYearlyDays([])
      }
      setMonthlyNthWeekdays(initialSelection?.monthlyNthWeekdays ? [...initialSelection.monthlyNthWeekdays] : [])
      setError(null)
    }
  }, [open, initialSelection])

  const countSelected = (
    period === 'week'
      ? weeklyDays.length
      : period === 'month'
        ? monthlyNthWeekdays.length
        : yearlyDays.length
  )

  const remaining = Math.max(0, amount - countSelected)
  const disabledMore = remaining === 0

  const maxForPeriod = (p: Period) => (p === 'week' ? 7 : p === 'month' ? 12 : 52)
  // Period is enforced externally; no dropdown UI
  const handleAmountChange = (n: number) => {
    const max = maxForPeriod(period)
    const next = Math.max(1, Math.min(n, max))
    if (onChangeAmount) onChangeAmount(next)
    // Also trim selection if currently exceeding
    if (period === 'week') setWeeklyDays((cur) => cur.slice(0, next))
    if (period === 'month') setMonthlyDays((cur) => cur.slice(0, next))
    if (period === 'year') setYearlyDays((cur) => cur.slice(0, next))
  }

  const periodOptions: Period[] = (allowedPeriods && allowedPeriods.length > 0)
    ? (allowedPeriods as Period[])
    : (['week', 'month', 'year'] as Period[])

  const handlePeriodChange = (p: Period) => {
    if (p === period) return
    // Clear current selections when switching period
    setWeeklyDays([])
    setMonthlyDays([])
    setMonthlyNthWeekdays([])
    setYearlyDays([])
    // Clamp amount to the new period's maximum
    const max = maxForPeriod(p)
    if (onChangeAmount) onChangeAmount(Math.max(1, Math.min(amount, max)))
    if (onChangePeriod) onChangePeriod(p)
  }

  // Monday-first UI: order [Mon,Tue,Wed,Thu,Fri,Sat,Sun]; underlying values use 0=Sunday mapping
  // UI index to underlying day number map
  const mondayFirstMap = [1,2,3,4,5,6,0]
  const toggleWeekdayUIIndex = (uiIndex: number) => {
    const dayNumber = mondayFirstMap[uiIndex]
    setWeeklyDays((current) => {
      const has = current.includes(dayNumber)
      if (has) return current.filter((x) => x !== dayNumber)
      if (disabledMore) return current
      return [...current, dayNumber]
    })
  }

  const _toggleMonthDay = (d: number) => {
    setMonthlyDays((cur) => {
      if (cur.includes(d)) return cur.filter((x) => x !== d)
      if (disabledMore) return cur
      return [...cur, d]
    })
  }

  // Yearly selection now mirrors Monthly's Nth-weekday picker, per month
  const toggleYearNthWeekday = (monthIdx: number, weekIndex: number, uiIndex: number) => {
    const mondayFirstMap = [1,2,3,4,5,6,0]
    const weekday = mondayFirstMap[uiIndex]
    const mm = String(monthIdx + 1).padStart(2, '0')
    const key = `${mm}-${weekIndex}-${weekday}`
    setYearlyDays((cur) => {
      const has = cur.includes(key)
      if (has) return cur.filter((x) => x !== key)
      if (disabledMore) return cur
      return [...cur, key]
    })
  }

  const toggleYearMonthHeader = (monthIdx: number, uiIndex: number) => {
    const mondayFirstMap = [1,2,3,4,5,6,0]
    const weekday = mondayFirstMap[uiIndex]
    const mm = String(monthIdx + 1).padStart(2, '0')
    const keys = [1,2,3,4].map(w => `${mm}-${w}-${weekday}`)
    setYearlyDays((cur) => {
      const allSelected = keys.every(k => cur.includes(k))
      if (allSelected) {
        return cur.filter(k => !keys.includes(k))
      }
      const result = [...cur]
      for (const k of keys) {
        if (result.includes(k)) continue
        if (disabledMore) break
        if (result.length >= amount) break
        result.push(k)
      }
      return result
    })
  }

  const toggleMonthlyNthWeekday = (weekIndex: number, uiIndex: number) => {
    const mondayFirstMap = [1,2,3,4,5,6,0]
    const weekday = mondayFirstMap[uiIndex]
    const key = `${weekIndex}-${weekday}`
    setMonthlyNthWeekdays((cur) => {
      const has = cur.includes(key)
      if (has) return cur.filter((x) => x !== key)
      if (disabledMore) return cur
      return [...cur, key]
    })
  }

  const toggleMonthlyNthWeekdayColumn = (uiIndex: number) => {
    const mondayFirstMap = [1,2,3,4,5,6,0]
    const weekday = mondayFirstMap[uiIndex]
    const keys = [1,2,3,4].map(w => `${w}-${weekday}`)
    setMonthlyNthWeekdays((cur) => {
      const allSelected = keys.every(k => cur.includes(k))
      if (allSelected) {
        return cur.filter(k => !keys.includes(k))
      }
      // Add keys until we hit the limit
      const result = [...cur]
      for (const k of keys) {
        if (result.includes(k)) continue
        if (disabledMore) break
        if (result.length >= amount) break
        result.push(k)
      }
      return result
    })
  }

  const save = async () => {
    setError(null)
    if (countSelected !== amount) {
      setError(`Select exactly ${amount} ${period === 'week' ? 'day(s) per week' : period === 'month' ? 'day(s) per month' : 'time(s) per year'}`)
      return
    }
    setSaving(true)
    try {
      const selection: ScheduleSelection = {}
      if (period === 'week') selection.weeklyDays = weeklyDays.sort((a, b) => a - b)
      if (period === 'month') {
        selection.monthlyNthWeekdays = [...monthlyNthWeekdays].sort()
        selection.monthlyDays = []
      }
      if (period === 'year') selection.yearlyDays = [...yearlyDays].sort()
      await onSave(selection)
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent className="rounded-2xl max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick your watering schedule</DialogTitle>
          <DialogDescription>
            {period === 'week' && `${amount} time(s) per week`}
            {period === 'month' && `${amount} time(s) per month`}
            {period === 'year' && `${amount} time(s) per year`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm opacity-70">Selected: {countSelected} / {amount}</div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex h-9 w-full items-center rounded-md border border-input dark:border-stone-600 bg-transparent px-1 py-1 text-base shadow-sm md:text-sm">
              <div className="flex gap-1 w-full">
                {(['week','month','year'] as Period[]).map((p) => {
                  const isAllowed = periodOptions.includes(p)
                  const isActive = period === p
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => isAllowed && handlePeriodChange(p)}
                      className={`flex-1 rounded-md border text-xs capitalize h-7 px-2 ${isActive ? 'bg-black text-white dark:bg-emerald-600 dark:border-emerald-600' : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'} ${!isAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-0 rounded-md border border-input bg-transparent overflow-hidden h-9">
              <button
                type="button"
                onClick={() => handleAmountChange(amount - 1)}
                disabled={amount <= 1 || !!lockToYear}
                className="h-full w-9 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="flex-1 text-center font-bold text-base tabular-nums select-none">{amount}</span>
              <button
                type="button"
                onClick={() => handleAmountChange(amount + 1)}
                disabled={amount >= maxForPeriod(lockToYear ? 'year' : period) || !!lockToYear}
                className="h-full w-9 flex items-center justify-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
            <div className="text-xs opacity-60">
              {(!lockToYear && period === 'week') && 'Max 7 per week.'}
              {(!lockToYear && period === 'month') && 'Max 12 per month.'}
              {(lockToYear || period === 'year') && 'Max 52 per year.'}
            </div>
          {allowedPeriods && allowedPeriods.length === 1 && (
            <div className="text-[11px] opacity-60">Frequency period is enforced by the plant. You can change the amount.</div>
          )}

          {(!lockToYear && period === 'week') && (
            <WeekPicker selectedNumbers={weeklyDays} onToggleNumber={toggleWeekdayUIIndex} disabledMore={disabledMore} />
          )}
          {period === 'month' && (
            <>
              <div className="text-xs opacity-70">Pick weeks (1–4) and weekdays. Example: 1st Mon.</div>
              <MonthNthWeekdayPicker selected={monthlyNthWeekdays} onToggle={toggleMonthlyNthWeekday} onToggleHeader={toggleMonthlyNthWeekdayColumn} disabledMore={disabledMore} />
            </>
          )}

          {(lockToYear || period === 'year') && (
            <>
              <div className="text-xs opacity-70">Select a month, then pick the week &amp; weekday. Example: Jan 1st Mon.</div>
              <YearMonthNthWeekdayPicker selected={yearlyDays} onToggle={toggleYearNthWeekday} onToggleHeader={toggleYearMonthHeader} disabledMore={disabledMore} />
            </>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button className="rounded-2xl" onClick={save} disabled={saving || countSelected !== amount}>{saving ? 'Saving…' : 'Save schedule'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WeekPicker({ selectedNumbers, onToggleNumber, disabledMore }: { selectedNumbers: number[]; onToggleNumber: (uiIndex: number) => void; disabledMore: boolean }) {
  // Monday-first display; mapping handled in parent
  const display = [
    { label: 'Mon', uiIndex: 0 },
    { label: 'Tue', uiIndex: 1 },
    { label: 'Wed', uiIndex: 2 },
    { label: 'Thu', uiIndex: 3 },
    { label: 'Fri', uiIndex: 4 },
    { label: 'Sat', uiIndex: 5 },
    { label: 'Sun', uiIndex: 6 },
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
            className={`h-12 rounded-xl border text-sm ${isOn ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!isOn && disabledMore}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function _MonthPicker({ selected, onToggle, disabledMore }: { selected: number[]; onToggle: (d: number) => void; disabledMore: boolean }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const isOn = selected.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            className={`h-10 rounded-xl border text-sm ${isOn ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!isOn && disabledMore}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

function MonthNthWeekdayPicker({ selected, onToggle, onToggleHeader, disabledMore }: { selected: string[]; onToggle: (weekIndex: number, uiIndex: number) => void; onToggleHeader: (uiIndex: number) => void; disabledMore: boolean }) {
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekNames = ['1st','2nd','3rd','4th']
  const mondayFirstMap = [1,2,3,4,5,6,0]
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
        <div className="text-xs opacity-70 text-center">WEEK</div>
        {labels.map((l, uiIndex) => (
          <button
            key={l}
            type="button"
            onClick={() => onToggleHeader(uiIndex)}
            className="h-8 rounded-lg border text-[11px] bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600"
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
            const key = `${rowIdx + 1}-${weekday}`
            const isOn = selected.includes(key)
            return (
              <button
                key={uiIndex}
                type="button"
                onClick={() => onToggle(rowIdx + 1, uiIndex)}
                className={`h-10 rounded-xl border text-sm ${isOn ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={!isOn && disabledMore}
                aria-label={`${wn} ${labels[uiIndex]}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function YearMonthNthWeekdayPicker({ selected, onToggle, onToggleHeader: _onToggleHeader, disabledMore }: { selected: string[]; onToggle: (monthIdx: number, weekIndex: number, uiIndex: number) => void; onToggleHeader: (monthIdx: number, uiIndex: number) => void; disabledMore: boolean }) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekLabels = ['1st','2nd','3rd','4th']
  const mondayFirstMap = [1,2,3,4,5,6,0]
  // Reverse map: weekday number → UI label index
  const weekdayToUI: Record<number, number> = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 0:6 }

  const [activeMonth, setActiveMonth] = React.useState<number | null>(null)

  // Count selections per month for badges
  const countByMonth = React.useMemo(() => {
    const counts: Record<number, number> = {}
    for (const key of selected) {
      const mm = parseInt(key.split('-')[0], 10)
      if (mm >= 1 && mm <= 12) counts[mm] = (counts[mm] || 0) + 1
    }
    return counts
  }, [selected])

  // Format a key like "03-1-1" into "Mar · 1st Mon"
  const formatKey = (key: string) => {
    const [mm, wi, wd] = key.split('-').map(Number)
    const monthLabel = months[mm - 1] || '?'
    const weekLabel = weekLabels[wi - 1] || `W${wi}`
    const dayLabel = dayLabels[weekdayToUI[wd] ?? 0] || '?'
    return `${monthLabel} · ${weekLabel} ${dayLabel}`
  }

  // Remove a single selection
  const removeKey = (key: string) => {
    const [mm, wi, wd] = key.split('-').map(Number)
    const uiIdx = weekdayToUI[wd] ?? 0
    // Calling onToggle on an already-selected cell removes it
    onToggle(mm - 1, wi, uiIdx)
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...selected].sort().map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-xs font-medium"
            >
              {formatKey(key)}
              <button
                type="button"
                onClick={() => removeKey(key)}
                className="ml-0.5 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-2">
        {months.map((label, idx) => {
          const count = countByMonth[idx + 1] || 0
          const isActive = activeMonth === idx
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMonth(isActive ? null : idx)}
              className={`relative h-12 rounded-xl border text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'
              }`}
            >
              {label}
              {count > 0 && !isActive && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Week × Weekday picker for active month */}
      {activeMonth !== null && (
        <div className="rounded-xl border dark:border-stone-700 p-3 space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="text-sm font-medium mb-1">
            {months[activeMonth]} — pick a week &amp; day
          </div>
          {/* Header row */}
          <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
            <div />
            {dayLabels.map((l) => (
              <div key={l} className="text-[11px] text-center opacity-60 font-medium">{l}</div>
            ))}
          </div>
          {/* Week rows */}
          {weekLabels.map((wn, rowIdx) => {
            const weekIndex = rowIdx + 1
            return (
              <div key={wn} className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                <div className="text-xs opacity-60 text-center">{wn}</div>
                {dayLabels.map((dl, uiIndex) => {
                  const weekday = mondayFirstMap[uiIndex]
                  const mm = String(activeMonth + 1).padStart(2, '0')
                  const key = `${mm}-${weekIndex}-${weekday}`
                  const isOn = selected.includes(key)
                  return (
                    <button
                      key={uiIndex}
                      type="button"
                      onClick={() => {
                        onToggle(activeMonth, weekIndex, uiIndex)
                        // If adding (not removing) and it completes the selection, close the month
                        // We don't auto-close on removal
                      }}
                      className={`h-10 rounded-xl border text-xs font-medium transition-all ${
                        isOn
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 dark:border-stone-600'
                      } ${!isOn && disabledMore ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={!isOn && disabledMore}
                      aria-label={`${months[activeMonth]} ${wn} ${dl}`}
                    >
                      {dl.slice(0, 2)}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

