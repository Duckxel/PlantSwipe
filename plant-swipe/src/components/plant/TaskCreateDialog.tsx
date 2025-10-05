// @ts-nocheck
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TaskType } from '@/types/garden'
import { createPatternTask } from '@/lib/gardens'

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
  const [type, setType] = React.useState<TaskType>('water')
  const [customName, setCustomName] = React.useState('')
  const [period, setPeriod] = React.useState<Period>('week')
  const [amount, setAmount] = React.useState<number>(1)
  const [requiredCount, setRequiredCount] = React.useState<number>(1)

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
      setPeriod('week')
      setAmount(1)
      setRequiredCount(1)
      setWeeklyDays([])
      setMonthlyNthWeekdays([])
      setYearlyDays([])
      setError(null)
    }
  }, [open])

  const maxForPeriod = (p: Period) => (p === 'week' ? 7 : p === 'month' ? 4 : 12)
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
      setError(
        `Select exactly ${amount} ${period === 'week' ? 'day(s) per week' : period === 'month' ? 'day(s) per month' : 'date(s) per year'}`
      )
      return
    }
    setSaving(true)
    try {
      await createPatternTask({
        gardenId,
        gardenPlantId,
        type,
        customName: type === 'custom' ? (customName || null) : null,
        period,
        amount,
        weeklyDays: period === 'week' ? [...weeklyDays].sort((a, b) => a - b) : null,
        monthlyDays: period === 'month' ? [] : null,
        yearlyDays: period === 'year' ? [...yearlyDays].sort() : null,
        monthlyNthWeekdays: period === 'month' ? [...monthlyNthWeekdays].sort() : null,
        requiredCount,
      })
      if (onCreated) await onCreated()
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>All tasks repeat. Choose frequency and calendar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm capitalize"
              value={type}
              onChange={(e: any) => setType(e.target.value)}
            >
              {(['water','fertilize','harvest','cut','custom'] as TaskType[]).map(v => (
                <option key={v} value={v} className="capitalize">{v}</option>
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm capitalize"
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
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>
          </div>

          {type === 'custom' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Custom task name</label>
              <Input value={customName} onChange={(e: any) => setCustomName(e.target.value)} placeholder="e.g., Prune roses" />
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm font-medium">Required count</label>
            <Input
              type="number"
              min={1}
              value={String(requiredCount)}
              onChange={(e: any) => setRequiredCount(Math.max(1, Number(e.target.value || '1')))}
            />
            <div className="text-xs opacity-60">Progress and completion use this count.</div>
          </div>

          <div className="text-sm opacity-60">
            {period === 'week' && 'Pick days Monday–Sunday'}
            {period === 'month' && 'Pick 1st–4th weekdays (e.g., 1st Mon)'}
            {period === 'year' && 'Pick specific dates across the year'}
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
              <div className="text-xs opacity-70">Pick weeks (1–4) and weekdays. Example: 1st Mon.</div>
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
            <YearPicker
              selected={yearlyDays}
              onToggle={(mmdd) => {
                setYearlyDays((cur) => {
                  if (cur.includes(mmdd)) return cur.filter((x) => x !== mmdd)
                  if (disabledMore) return cur
                  return [...cur, mmdd]
                })
              }}
              disabledMore={disabledMore}
            />
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button className="rounded-2xl" onClick={save} disabled={saving || countSelected !== amount}>{saving ? 'Creating…' : 'Create task'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function WeekPicker({ selectedNumbers, onToggleNumber, disabledMore }: { selectedNumbers: number[]; onToggleNumber: (uiIndex: number) => void; disabledMore: boolean }) {
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

function MonthNthWeekdayPicker({ selected, onToggle, onToggleHeader, disabledMore }: { selected: string[]; onToggle: (weekIndex: number, uiIndex: number) => void; onToggleHeader: (uiIndex: number) => void; disabledMore: boolean }) {
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-2 items-center">
        <div className="text-xs opacity-70 text-center">WEEK</div>
        {labels.map((l, uiIndex) => (
          <button
            key={l}
            type="button"
            onClick={() => onToggleHeader(uiIndex)}
            className={`h-8 rounded-lg border text-[11px] ${'bg-white hover:bg-stone-50'}`}
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
                className={`h-10 rounded-xl border text-sm ${isOn ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'} ${!isOn && disabledMore ? 'opacity-60 cursor-not-allowed' : ''}`}
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
