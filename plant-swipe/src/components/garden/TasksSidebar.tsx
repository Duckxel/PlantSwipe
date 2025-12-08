// @ts-nocheck
import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'

const taskTypeConfig = {
  water: { emoji: '💧', color: 'bg-blue-600 dark:bg-blue-500' },
  fertilize: { emoji: '🌱', color: 'bg-green-600 dark:bg-green-500' },
  harvest: { emoji: '🌾', color: 'bg-yellow-500 dark:bg-yellow-400' },
  cut: { emoji: '✂️', color: 'bg-orange-600 dark:bg-orange-500' },
  custom: { emoji: '🪴', color: 'bg-purple-600 dark:bg-purple-500' },
}

export function TasksSidebar({ className = '', gardenName, plants, todayTaskOccurrences, onProgressOccurrence, onCompleteAllForPlant }: {
  className?: string
  gardenName: string
  plants: Array<any>
  todayTaskOccurrences: Array<{ id: string; taskId: string; gardenPlantId: string; dueAt: string; requiredCount: number; completedCount: number; completedAt: string | null; taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'; taskEmoji?: string | null }>
  onProgressOccurrence: (occId: string, inc: number) => Promise<void>
  onCompleteAllForPlant: (gardenPlantId: string) => Promise<void>
}) {
  const { t } = useTranslation('common')
  const [progressingIds, setProgressingIds] = React.useState<Set<string>>(new Set())
  const [completingPlantIds, setCompletingPlantIds] = React.useState<Set<string>>(new Set())

  const occsByPlant: Record<string, typeof todayTaskOccurrences> = React.useMemo(() => {
    const map: Record<string, typeof todayTaskOccurrences> = {}
    for (const o of (todayTaskOccurrences || [])) {
      if (!map[o.gardenPlantId]) map[o.gardenPlantId] = [] as any
      map[o.gardenPlantId].push(o)
    }
    return map
  }, [todayTaskOccurrences])

  const plantsWithTasks = React.useMemo(() => {
    return plants.filter((gp: any) => (occsByPlant[gp.id] || []).length > 0)
  }, [plants, occsByPlant])

  const totalTasks = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0), [todayTaskOccurrences])
  const totalDone = React.useMemo(() => todayTaskOccurrences.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0), [todayTaskOccurrences])

  const getTaskIcon = (taskType: string, emoji?: string | null) => {
    if (emoji && emoji !== '??' && emoji !== '???' && emoji.trim() !== '') {
      return emoji
    }
    return taskTypeConfig[taskType as keyof typeof taskTypeConfig]?.emoji || '🪴'
  }

  const handleProgress = async (occId: string, inc: number) => {
    setProgressingIds(prev => new Set(prev).add(occId))
    try {
      await onProgressOccurrence(occId, inc)
    } finally {
      setProgressingIds(prev => {
        const next = new Set(prev)
        next.delete(occId)
        return next
      })
    }
  }

  const handleCompleteAll = async (plantId: string) => {
    setCompletingPlantIds(prev => new Set(prev).add(plantId))
    try {
      await onCompleteAllForPlant(plantId)
    } finally {
      setCompletingPlantIds(prev => {
        const next = new Set(prev)
        next.delete(plantId)
        return next
      })
    }
  }

  return (
    <aside className={`${className}`}>
      <div className="space-y-3">
        <div className="text-lg font-semibold">{t('garden.tasks', 'Tasks')}</div>
        <Card className="rounded-2xl p-3 md:p-4">
          <div className="text-xs md:text-sm opacity-60 mb-2">{gardenName}</div>
          <div className="h-1.5 md:h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300" style={{ width: `${totalTasks === 0 ? 100 : Math.min(100, Math.round((totalDone / totalTasks) * 100))}%` }} />
          </div>
          <div className="text-[10px] md:text-xs opacity-70 mt-1">{t('garden.today', 'Today')}: {totalDone} / {totalTasks}</div>
        </Card>
        <div className="space-y-2 md:space-y-3">
          {plantsWithTasks.length === 0 && (
            <Card className="rounded-2xl p-3 md:p-4 text-xs md:text-sm opacity-70">
              {t('garden.noTasksToday', 'No tasks due today.')} 🌿
            </Card>
          )}
          {plantsWithTasks.map((gp: any) => {
            const occs = occsByPlant[gp.id] || []
            const req = occs.reduce((a, o) => a + Math.max(1, Number(o.requiredCount || 1)), 0)
            const done = occs.reduce((a, o) => a + Math.min(Math.max(1, Number(o.requiredCount || 1)), Number(o.completedCount || 0)), 0)
            const allDone = done >= req
            const isCompleting = completingPlantIds.has(gp.id)
            
            return (
              <Card key={gp.id} className="rounded-2xl p-2 md:p-3">
                {/* Plant Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs md:text-sm truncate">{gp.nickname || gp.plant?.name}</div>
                    <div className="text-[10px] md:text-xs opacity-60">{done} / {req} {t('garden.done', 'done')}</div>
                  </div>
                  {!allDone && (
                    <Button 
                      size="sm" 
                      className="rounded-lg h-6 md:h-7 px-2 text-[10px] md:text-xs flex-shrink-0" 
                      onClick={() => handleCompleteAll(gp.id)}
                      disabled={isCompleting}
                    >
                      {isCompleting ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        t('garden.completeAll', 'Complete All')
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Task List */}
                <div className="space-y-1.5">
                  {occs.map((o) => {
                    const tt = (o as any).taskType || 'custom'
                    const isDone = Number(o.completedCount || 0) >= Number(o.requiredCount || 1)
                    const isProgressing = progressingIds.has(o.id)
                    const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
                    
                    return (
                      <div 
                        key={o.id} 
                        className={`flex items-center gap-2 p-1.5 md:p-2 rounded-lg ${
                          isDone 
                            ? 'bg-stone-50/80 dark:bg-stone-800/30 opacity-60' 
                            : 'bg-white/80 dark:bg-stone-800/50'
                        }`}
                      >
                        {/* Task Icon */}
                        <span className="text-sm md:text-base flex-shrink-0">
                          {getTaskIcon(tt, o.taskEmoji)}
                        </span>
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] md:text-xs ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            {t(`garden.taskTypes.${tt}`, tt)}
                          </span>
                          {o.requiredCount > 1 && !isDone && (
                            <span className="text-[9px] md:text-[10px] opacity-60 ml-1">
                              {o.completedCount || 0}/{o.requiredCount}
                            </span>
                          )}
                        </div>
                        
                        {/* Complete Button */}
                        {!isDone ? (
                          <Button 
                            className="rounded-md h-5 md:h-6 px-1.5 md:px-2 text-[9px] md:text-[10px] flex-shrink-0" 
                            size="sm"
                            variant="secondary"
                            onClick={() => handleProgress(o.id, remaining)} 
                            disabled={isProgressing}
                          >
                            {isProgressing ? (
                              <span className="animate-spin text-xs">⏳</span>
                            ) : (
                              t('garden.complete', 'Complete')
                            )}
                          </Button>
                        ) : (
                          <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-emerald-500 flex-shrink-0" />
                        )}
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
