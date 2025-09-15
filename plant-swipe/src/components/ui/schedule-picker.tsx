import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Period = 'week' | 'month' | 'year'

export type ScheduleValue = {
  period: Period
  amount: number
  weeklyDays?: number[]
  monthlyDays?: number[]
  yearlyDays?: string[]
}

export function SchedulePicker({
  initial,
  onChange,
}: {
  initial: ScheduleValue
  onChange: (v: ScheduleValue) => void
}) {
  const [period, setPeriod] = React.useState<Period>(initial.period)
  const [amount, setAmount] = React.useState<number>(initial.amount || 1)
  const [weeklyDays, setWeeklyDays] = React.useState<number[]>(initial.weeklyDays || [])
  const [monthlyDays, setMonthlyDays] = React.useState<number[]>(initial.monthlyDays || [])
  const [yearlyDays, setYearlyDays] = React.useState<string[]>(initial.yearlyDays || [])

  React.useEffect(() => {
    onChange({ period, amount: Math.max(1, amount), weeklyDays, monthlyDays, yearlyDays })
  }, [period, amount, weeklyDays, monthlyDays, yearlyDays])

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>Period</Label>
        <div className="flex gap-2">
          {(['week','month','year'] as const).map(p => (
            <Button key={p} type="button" variant={period === p ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setPeriod(p)}>{p}</Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Times per {period}</Label>
        <Input type="number" min={1} value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Math.max(1, Number(e.target.value || 1)))} className="w-28" />
      </div>
      {period === 'week' && (
        <div className="grid gap-2">
          <Label>Days of week</Label>
          <div className="flex flex-wrap gap-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => {
              const active = weeklyDays.includes(idx)
              return (
                <button type="button" key={d} onClick={() => setWeeklyDays(active ? weeklyDays.filter((x: number) => x !== idx) : [...weeklyDays, idx])} className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${active ? 'bg-black text-white' : 'bg-white hover:bg-stone-50'}`}>{d}</button>
              )
            })}
          </div>
        </div>
      )}
      {period === 'month' && (
        <div className="grid gap-2">
          <Label>Days of month</Label>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-auto p-1 rounded-xl border">
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
              const active = monthlyDays.includes(d)
              return (
                <button type="button" key={d} onClick={() => setMonthlyDays(active ? monthlyDays.filter((x: number) => x !== d) : [...monthlyDays, d])} className={`w-8 h-8 rounded-md text-sm ${active ? 'bg-black text-white' : 'bg-stone-200'}`}>{d}</button>
              )
            })}
          </div>
        </div>
      )}
      {period === 'year' && (
        <div className="grid gap-2">
          <Label>MM-DD selections</Label>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Input placeholder="MM-DD" className="w-28" onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  const val = (e.currentTarget.value || '').trim()
                  if (/^\d{2}-\d{2}$/.test(val) && !yearlyDays.includes(val)) {
                    setYearlyDays([...yearlyDays, val])
                    e.currentTarget.value = ''
                  }
                }
              }} />
              <span className="text-xs opacity-60">Press Enter to add</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {yearlyDays.map((v: string) => (
                <button type="button" key={v} onClick={() => setYearlyDays(yearlyDays.filter((x: string) => x !== v))} className="px-2 py-0.5 rounded-xl bg-stone-200 text-sm">{v}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

