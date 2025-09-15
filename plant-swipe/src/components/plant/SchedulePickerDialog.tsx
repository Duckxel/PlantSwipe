// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Period = 'week' | 'month' | 'year'

export interface ScheduleSelection {
  weeklyDays?: number[]
  monthlyDays?: number[]
  yearlyDays?: string[]
}

export function SchedulePickerDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: Period
  amount: number
  onSave: (selection: ScheduleSelection) => Promise<void>
}) {
  const { open, onOpenChange, period, amount, onSave } = props

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [weeklyDays, setWeeklyDays] = React.useState<number[]>([])
  const [monthlyDays, setMonthlyDays] = React.useState<number[]>([])
  const [yearlyDays, setYearlyDays] = React.useState<string[]>([])

  React.useEffect(() => {
    // Reset selection on open
    if (open) {
      setWeeklyDays([])
      setMonthlyDays([])
      setYearlyDays([])
      setError(null)
    }
  }, [open])

  const countSelected = period === 'week' ? weeklyDays.length : period === 'month' ? monthlyDays.length : yearlyDays.length

  const remaining = Math.max(0, amount - countSelected)
  const disabledMore = remaining === 0

  const toggleWeekday = (d: number) => {
    setWeeklyDays((cur) => {
      if (cur.includes(d)) return cur.filter((x) => x !== d)
      if (disabledMore) return cur
      return [...cur, d]
    })
  }

  const toggleMonthDay = (d: number) => {
    setMonthlyDays((cur) => {
      if (cur.includes(d)) return cur.filter((x) => x !== d)
      if (disabledMore) return cur
      return [...cur, d]
    })
  }

  const toggleYearDay = (mmdd: string) => {
    setYearlyDays((cur) => {
      if (cur.includes(mmdd)) return cur.filter((x) => x !== mmdd)
      if (disabledMore) return cur
      return [...cur, mmdd]
    })
  }

  const save = async () => {
    setError(null)
    if (countSelected !== amount) {
      setError(`Select exactly ${amount} ${period === 'week' ? 'day(s) per week' : period === 'month' ? 'day(s) per month' : 'date(s) per year'}`)
      return
    }
    setSaving(true)
    try {
      const selection: ScheduleSelection = {}
      if (period === 'week') selection.weeklyDays = weeklyDays.sort((a, b) => a - b)
      if (period === 'month') selection.monthlyDays = monthlyDays.sort((a, b) => a - b)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {period === 'week' && (
            <WeekPicker selected={weeklyDays} onToggle={toggleWeekday} disabledMore={disabledMore} />
          )}

          {period === 'month' && (
            <MonthPicker selected={monthlyDays} onToggle={toggleMonthDay} disabledMore={disabledMore} />
          )}

          {period === 'year' && (
            <YearPicker selected={yearlyDays} onToggle={toggleYearDay} disabledMore={disabledMore} />
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

function WeekPicker({ selected, onToggle, disabledMore }: { selected: number[]; onToggle: (d: number) => void; disabledMore: boolean }) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((label, idx) => {
        const isOn = selected.includes(idx)
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onToggle(idx)}
            className={`h-12 rounded-xl border text-sm ${isOn ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!isOn && disabledMore}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MonthPicker({ selected, onToggle, disabledMore }: { selected: number[]; onToggle: (d: number) => void; disabledMore: boolean }) {
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
            className={`h-10 rounded-xl border text-sm ${isOn ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={!isOn && disabledMore}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

function YearPicker({ selected, onToggle, disabledMore }: { selected: string[]; onToggle: (mmdd: string) => void; disabledMore: boolean }) {
  const months = [
    ['Jan', 31], ['Feb', 29], ['Mar', 31], ['Apr', 30], ['May', 31], ['Jun', 30],
    ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Oct', 31], ['Nov', 30], ['Dec', 31],
  ] as Array<[string, number]>
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[60vh] overflow-auto pr-1">
      {months.map(([label, count], monthIdx) => (
        <div key={label} className="rounded-xl border p-2">
          <div className="text-xs opacity-70 mb-2">{label}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: count }, (_, i) => i + 1).map((d) => {
              const mm = String(monthIdx + 1).padStart(2, '0')
              const dd = String(d).padStart(2, '0')
              const mmdd = `${mm}-${dd}`
              const isOn = selected.includes(mmdd)
              return (
                <button
                  key={mmdd}
                  type="button"
                  onClick={() => onToggle(mmdd)}
                  className={`h-9 rounded-lg border text-[11px] ${isOn ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
                  disabled={!isOn && disabledMore}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

