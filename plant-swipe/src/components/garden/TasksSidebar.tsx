import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'

const taskTypeConfig = {
  water: { 
    emoji: '💧', 
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700/60',
    buttonOutline: 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
  },
  fertilize: { 
    emoji: '🌱', 
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20',
    border: 'border-green-300 dark:border-green-700/60',
    buttonOutline: 'border-green-400 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
  },
  harvest: { 
    emoji: '🌾', 
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700/60',
    buttonOutline: 'border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
  },
  cut: { 
    emoji: '✂️', 
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700/60',
    buttonOutline: 'border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
  },
  custom: { 
    emoji: '🪴', 
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700/60',
    buttonOutline: 'border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
  },
}

interface GardenPlant {
  id: string
  nickname?: string | null
  plant?: { name?: string }
}

type TaskOccurrence = { 
  id: string
  taskId: string
  gardenPlantId: string
  dueAt: string
  requiredCount: number
  completedCount: number
  completedAt: string | null
  taskType?: 'water' | 'fertilize' | 'harvest' | 'cut' | 'custom'
  taskEmoji?: string | null 
}

export function TasksSidebar({ className = '', gardenName, plants, todayTaskOccurrences, onProgressOccurrence, onCompleteAllForPlant }: {
  className?: string
  gardenName: string
  plants: GardenPlant[]
  todayTaskOccurrences: TaskOccurrence[]
  onProgressOccurrence: (occId: string, inc: number) => Promise<void>
  onCompleteAllForPlant: (gardenPlantId: string) => Promise<void>
}) {
  const { t } = useTranslation('common')
  const [progressingIds, setProgressingIds] = React.useState<Set<string>>(new Set())
  const [completingPlantIds, setCompletingPlantIds] = React.useState<Set<string>>(new Set())

  const occsByPlant: Record<string, TaskOccurrence[]> = React.useMemo(() => {
    const map: Record<string, TaskOccurrence[]> = {}
    for (const o of (todayTaskOccurrences || [])) {
      if (!map[o.gardenPlantId]) map[o.gardenPlantId] = []
      map[o.gardenPlantId].push(o)
    }
    return map
  }, [todayTaskOccurrences])

  const plantsWithTasks = React.useMemo(() => {
    return plants.filter((gp: GardenPlant) => (occsByPlant[gp.id] || []).length > 0)
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
          {plantsWithTasks.map((gp: GardenPlant) => {
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
                      variant="outline"
                      className="rounded-lg h-6 md:h-7 px-2 text-[10px] md:text-xs flex-shrink-0 border-2 border-emerald-400 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-semibold transition-all" 
                      onClick={() => handleCompleteAll(gp.id)}
                      disabled={isCompleting}
                    >
                      {isCompleting ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-0.5" />
                          {t('garden.completeAll', 'Complete All')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Task List */}
                <div className="space-y-1.5">
                  {occs.map((o) => {
                    const tt = o.taskType || 'custom'
                    const config = taskTypeConfig[tt as keyof typeof taskTypeConfig] || taskTypeConfig.custom
                    const isDone = Number(o.completedCount || 0) >= Number(o.requiredCount || 1)
                    const isProgressing = progressingIds.has(o.id)
                    const remaining = Math.max(0, Number(o.requiredCount || 1) - Number(o.completedCount || 0))
                    
                    return (
                      <div 
                        key={o.id} 
                        className={`flex items-center gap-2 p-2 md:p-2.5 rounded-xl transition-all ${
                          isDone 
                            ? 'bg-stone-50/80 dark:bg-stone-800/30 opacity-60' 
                            : `${config.bg} ${config.border} border shadow-sm`
                        }`}
                      >
                        {/* Task Icon */}
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDone ? 'bg-stone-100 dark:bg-stone-700/30' : 'bg-white dark:bg-stone-900/80 shadow-sm'
                        }`}>
                          <span className="text-base md:text-lg">
                            {getTaskIcon(tt, o.taskEmoji)}
                          </span>
                        </div>
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs md:text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : config.color}`}>
                            {t(`garden.taskTypes.${tt}`, tt)}
                          </span>
                          {o.requiredCount > 1 && !isDone && (
                            <span className="text-[9px] md:text-[10px] opacity-60 ml-1">
                              {o.completedCount || 0}/{o.requiredCount}
                            </span>
                          )}
                        </div>
                        
                        {/* Complete Button - Secondary/Outline style */}
                        {!isDone ? (
                          <Button 
                            className={`rounded-lg h-6 md:h-7 px-2 md:px-2.5 text-[10px] md:text-xs font-semibold flex-shrink-0 border-2 transition-all ${config.buttonOutline}`}
                            size="sm"
                            variant="outline"
                            onClick={() => handleProgress(o.id, remaining)} 
                            disabled={isProgressing}
                          >
                            {isProgressing ? (
                              <span className="animate-spin text-xs">⏳</span>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 mr-0.5" />
                                {t('garden.complete', 'Complete')}
                              </>
                            )}
                          </Button>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 flex-shrink-0" />
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
