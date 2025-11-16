// @ts-nocheck
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function TasksSidebar({ className = '', gardenName, plants, todayTaskOccurrences, onProgressOccurrence, onCompleteAllForPlant }: {
  className?: string
  gardenName: string
  plants: Array<any>
  todayTaskOccurrences: Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null; taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'; taskEmoji?: string | null }>
  onProgressOccurrence: (occId: string, inc: number) => Promise<void>
  onCompleteAllForPlant: (gardenPlantId: string) => Promise<void>
}) {
  const occsByPlant: Record<string, typeof todayTaskOccurrences> = React.useMemo(() => {
    const map: Record<string, typeof todayTaskOccurrences> = {}
    for (const o of (todayTaskOccurrences || [])) {
      if (!map[o.gardenPlantId]) map[o.gardenPlantId] = [] as any
      map[o.gardenPlantId].push(o)
    }
    return map
  }, [todayTaskOccurrences])

  const typeToColor: Record<'water'|'fertilize'|'harvest'|'cut'|'custom', string> = {
    water: 'bg-blue-600 dark:bg-blue-500',
    fertilize: 'bg-green-600 dark:bg-green-500',
    harvest: 'bg-yellow-500 dark:bg-yellow-400',
    cut: 'bg-orange-600 dark:bg-orange-500',
    custom: 'bg-purple-600 dark:bg-purple-500',
  }

  const plantsWithTasks = React.useMemo(() => {
    return plants.filter((gp: any) => (occsByPlant[gp.id] || []).length > 0)
  }, [plants, occsByPlant])

  const totalTasks = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0), [todayTaskOccurrences])
  const totalDone = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0), [todayTaskOccurrences])

  return (
    <aside className={`${className}`}>
      <div className="space-y-3">
        <div className="text-lg font-semibold">Tasks</div>
        <Card className="rounded-2xl p-4">
          <div className="text-sm opacity-60 mb-2">{gardenName}</div>
          <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
            <div className="h-2 bg-emerald-600 dark:bg-emerald-500" style={{ width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%` }} />
          </div>
          <div className="text-xs opacity-70 mt-1">Today: {totalDone} / {totalTasks}</div>
        </Card>
        <div className="space-y-3">
          {plantsWithTasks.length === 0 && (
            <Card className="rounded-2xl p-4 text-sm opacity-70">No tasks due today. 🌿</Card>
          )}
          {plantsWithTasks.map((gp: any) => {
            const occs = occsByPlant[gp.id] || []
            const req = occs.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0)
            const done = occs.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
            return (
              <Card key={gp.id} className="rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{gp.nickname || gp.plant?.name}</div>
                    {gp.nickname && <div className="text-xs opacity-60">{gp.plant?.name}</div>}
                    <div className="text-xs opacity-70">{done} / {req} done</div>
                  </div>
                  {(done < req) && (
                    <Button size="sm" className="rounded-xl" onClick={() => onCompleteAllForPlant(gp.id)}>Complete all</Button>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {occs.map((o) => {
                    const tt = (o as any).taskType || 'custom'
                    const badgeClass = `${typeToColor[tt]} ${tt === 'harvest' ? 'text-black' : 'text-white'}`
                    const icon = (o as any).taskEmoji || (tt === 'water' ? '💧' : tt === 'fertilize' ? '🍽️' : tt === 'harvest' ? '🌾' : tt === 'cut' ? '✂️' : '🪴')
                    return (
                      <div key={o.id} className="flex items-center justify-between gap-3 text-sm rounded-xl border p-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-6 w-6 flex items-center justify-center rounded-md border`}>{icon}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{String(tt).toUpperCase()}</span>
                          <span className="text-xs opacity-70">{gp.nickname || gp.plant?.name}</span>
                        </div>
                        <div className="opacity-80">{o.completedCount} / {o.requiredCount}</div>
                        <Button className="rounded-xl" size="sm" onClick={() => onProgressOccurrence(o.id, 1)} disabled={(o.completedCount || 0) >= (o.requiredCount || 1)}>+1</Button>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
