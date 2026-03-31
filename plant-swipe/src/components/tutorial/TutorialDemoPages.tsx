import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Heart, Sprout, Search, Camera, Upload, Plus,
  LayoutDashboard, ListChecks, BookOpen, BarChart3, Settings,
  Droplets, Scissors, CheckCircle2, Grid3X3,
  Sparkles, History, Leaf,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TutorialStep } from '@/context/TutorialContext'

/** Fake plant data used across demo pages */
const DEMO_PLANTS = [
  { name: 'Monstera', scientific: 'Monstera deliciosa', rarity: 'Common', seasons: ['spring', 'summer'], image: '🪴' },
  { name: 'Snake Plant', scientific: 'Sansevieria trifasciata', rarity: 'Common', seasons: ['all'], image: '🌿' },
  { name: 'Lavender', scientific: 'Lavandula angustifolia', rarity: 'Uncommon', seasons: ['summer'], image: '💜' },
  { name: 'Basil', scientific: 'Ocimum basilicum', rarity: 'Common', seasons: ['spring', 'summer'], image: '🌱' },
  { name: 'Aloe Vera', scientific: 'Aloe barbadensis', rarity: 'Common', seasons: ['all'], image: '🌵' },
  { name: 'Orchid', scientific: 'Phalaenopsis', rarity: 'Rare', seasons: ['winter', 'spring'], image: '🌸' },
]

function DemoDiscovery() {
  const { t } = useTranslation('common')
  const plant = DEMO_PLANTS[0]
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-4 pb-20">
      <div className="w-full max-w-sm">
        <Card className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 h-[420px] shadow-xl">
          <div className="absolute inset-0 flex items-center justify-center text-[120px] opacity-60">{plant.image}</div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute top-4 left-4 z-10">
            <Badge className="bg-emerald-500/90 text-white backdrop-blur">{t('discoveryPage.plantOfMonth', 'Plant of the Month')}</Badge>
          </div>
          <div className="absolute top-4 right-4 z-10">
            <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Heart className="h-6 w-6 text-stone-800" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className="bg-emerald-500/80 text-white text-xs">{plant.rarity}</Badge>
              {plant.seasons.map(s => <Badge key={s} className="bg-white/20 text-white text-xs">{s}</Badge>)}
            </div>
            <h2 className="text-2xl font-bold">{plant.name}</h2>
            <p className="text-white/80 text-sm italic">{plant.scientific}</p>
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" className="rounded-2xl bg-white/95 text-black px-8">{t('plant.info', 'Info')}</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function DemoEncyclopedia() {
  const { t } = useTranslation('common')
  const cats = [
    { emoji: '🌵', label: t('categories.cactusSucculent', 'Cacti & Succulents') },
    { emoji: '🌸', label: t('categories.flowering', 'Flowering Plants') },
    { emoji: '🥬', label: t('categories.vegetable', 'Vegetables') },
    { emoji: '🐾', label: t('categories.petSafe', 'Pet-Safe') },
    { emoji: '🌿', label: t('categories.herb', 'Herbs') },
    { emoji: '🌻', label: t('categories.easyGrowing', 'Easy Growing') },
  ]
  return (
    <div className="px-4 pt-4 pb-20">
      <h1 className="text-2xl font-bold mb-2 text-stone-900 dark:text-white">{t('categories.title', 'Categories')}</h1>
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 h-10 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center gap-2 px-3">
          <Search className="h-4 w-4 text-stone-400" />
          <span className="text-sm text-stone-400">{t('plant.searchPlaceholder', 'Search plants...')}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cats.map((cat, i) => (
          <Card key={i} className="rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow cursor-default">
            <span className="text-3xl">{cat.emoji}</span>
            <span className="text-sm font-medium text-center text-stone-700 dark:text-stone-300">{cat.label}</span>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DemoScan() {
  const { t } = useTranslation('common')
  return (
    <div className="px-4 pt-4 pb-20">
      <h1 className="text-2xl font-bold mb-1 text-stone-900 dark:text-white">{t('scan.title', 'Plant Scanner')}</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{t('scan.subtitle', 'Take a photo or upload an image to identify any plant')}</p>
      <Card className="p-6 rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 mb-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex gap-3">
            <Button variant="outline" className="rounded-2xl gap-2"><Camera className="h-5 w-5" />{t('scan.takePhoto', 'Take Photo')}</Button>
            <Button variant="outline" className="rounded-2xl gap-2"><Upload className="h-5 w-5" />{t('scan.upload', 'Upload')}</Button>
          </div>
        </div>
      </Card>
      <div className="flex items-center gap-2 mb-3">
        <History className="h-5 w-5 text-stone-400" />
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white">{t('scan.history', 'Your Scans')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: 'Monstera', confidence: '96%', emoji: '🪴' },
          { name: 'Lavender', confidence: '89%', emoji: '💜' },
          { name: 'Basil', confidence: '93%', emoji: '🌱' },
          { name: 'Orchid', confidence: '91%', emoji: '🌸' },
        ].map((s, i) => (
          <Card key={i} className="rounded-2xl overflow-hidden cursor-default">
            <div className="h-24 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center text-4xl">{s.emoji}</div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{s.name}</span>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">{s.confidence}</Badge>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-stone-500">{t('scan.inDatabase', 'In database')}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DemoGardens() {
  const { t } = useTranslation('common')
  const gardens = [
    { name: t('tutorial.demo.balconyGarden', 'My Balcony Garden'), type: 'default', plants: 12, tasks: '3/5', emoji: '🌿' },
    { name: t('tutorial.demo.indoorGarden', 'Indoor Plants'), type: 'beginners', plants: 6, tasks: '2/2', emoji: '🪴' },
    { name: t('tutorial.demo.herbGarden', 'Herb Garden'), type: 'default', plants: 8, tasks: '1/4', emoji: '🌱' },
  ]
  return (
    <div className="px-4 pt-4 pb-20">
      <div className="rounded-[28px] border border-stone-200 dark:border-stone-700 bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] p-6 mb-6 shadow-lg">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">{t('garden.yourGardens', 'Your Gardens')}</h1>
        <Button className="rounded-2xl mt-3 shadow-lg shadow-emerald-500/20"><Plus className="h-4 w-4 mr-1" />{t('garden.create', 'Create')}</Button>
      </div>
      <div className="space-y-3">
        {gardens.map((g, i) => (
          <Card key={i} className="rounded-2xl p-4 cursor-default hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-2xl">{g.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{g.name}</span>
                  {g.type === 'beginners' && <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 text-[10px]">{t('garden.beginnerTag', 'Beginner')}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1"><Sprout className="h-3 w-3" />{g.plants} {t('gardenDashboard.plants', 'plants')}</span>
                  <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{g.tasks}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DemoGardenDashboard({ stepId }: { stepId: string }) {
  const { t } = useTranslation('common')
  const tabs = [
    { key: 'overview', icon: LayoutDashboard },
    { key: 'plants', icon: Sprout },
    { key: 'tasks', icon: ListChecks },
    { key: 'journal', icon: BookOpen },
    { key: 'analytics', icon: BarChart3 },
    { key: 'settings', icon: Settings },
  ]
  const activeTab = stepId === 'gardens_analytics' ? 'analytics'
    : stepId === 'gardens_plants' ? 'plants'
    : stepId === 'gardens_tasks' ? 'tasks'
    : stepId === 'gardens_seedling' ? 'tray'
    : 'overview'

  const showSeedlingTab = stepId === 'gardens_seedling'
  if (showSeedlingTab) {
    tabs.splice(1, 0, { key: 'tray', icon: Grid3X3 })
  }

  return (
    <div className="px-4 pt-4 pb-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-xl">🌿</div>
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-white">{t('tutorial.demo.balconyGarden', 'My Balcony Garden')}</h1>
          <p className="text-xs text-stone-500">12 {t('gardenDashboard.plants', 'plants')} · 5 {t('gardenDashboard.tasks', 'tasks')}</p>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
        {tabs.map(({ key, icon: Icon }) => (
          <div key={key} className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
            key === activeTab ? "bg-emerald-600 text-white shadow-sm" : "text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800"
          )}>
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(`gardenDashboard.${key}`, key)}</span>
          </div>
        ))}
      </div>
      {/* Tab content */}
      {activeTab === 'overview' && <DemoOverviewTab />}
      {activeTab === 'plants' && <DemoPlantsTab />}
      {activeTab === 'analytics' && <DemoAnalyticsTab />}
      {activeTab === 'tasks' && <DemoTasksTab />}
      {activeTab === 'tray' && <DemoSeedlingTab />}
    </div>
  )
}

function DemoOverviewTab() {
  const { t } = useTranslation('common')
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">{t('gardenDashboard.todayProgress', "Today's Progress")}</span>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">3/5</Badge>
        </div>
        <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-700"><div className="h-2 rounded-full bg-emerald-500" style={{ width: '60%' }} /></div>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('gardenDashboard.plants', 'Plants'), value: '12', icon: Sprout, color: 'text-emerald-500' },
          { label: t('gardenDashboard.tasks', 'Tasks'), value: '5', icon: ListChecks, color: 'text-orange-500' },
          { label: t('gardenDashboard.overview', 'Streak'), value: '7d', icon: Sparkles, color: 'text-amber-500' },
        ].map((s, i) => (
          <Card key={i} className="rounded-xl p-3 text-center">
            <s.icon className={cn("h-5 w-5 mx-auto mb-1", s.color)} />
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-[10px] text-stone-500">{s.label}</div>
          </Card>
        ))}
      </div>
      {DEMO_PLANTS.slice(0, 3).map((p, i) => (
        <Card key={i} className="rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">{p.image}</span>
          <div className="flex-1"><span className="font-medium text-sm">{p.name}</span><p className="text-xs text-stone-500 italic">{p.scientific}</p></div>
          <div className="flex items-center gap-1 text-xs text-blue-500"><Droplets className="h-3 w-3" />2d</div>
        </Card>
      ))}
    </div>
  )
}

function DemoPlantsTab() {
  return (
    <div className="space-y-3">
      {DEMO_PLANTS.slice(0, 4).map((p, i) => (
        <Card key={i} className="rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">{p.image}</span>
          <div className="flex-1">
            <span className="font-medium text-sm">{p.name}</span>
            <p className="text-xs text-stone-500 italic">{p.scientific}</p>
          </div>
          <div className="flex flex-col gap-1 items-end text-xs text-stone-500">
            <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-400" />3d ago</span>
            <span className="flex items-center gap-1"><Scissors className="h-3 w-3 text-orange-400" />1w ago</span>
          </div>
        </Card>
      ))}
    </div>
  )
}

function DemoAnalyticsTab() {
  const { t } = useTranslation('common')
  const bars = [40, 65, 50, 80, 60, 75, 90, 55, 70, 85, 45, 95, 60, 78]
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-3">{t('gardenDashboard.analytics', 'Analytics')} — {t('tutorial.demo.wateringHistory', 'Watering History')}</h3>
        <div className="flex items-end gap-1 h-24">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-emerald-400 dark:bg-emerald-600 transition-all" style={{ height: `${h}%` }} />
              <span className="text-[8px] text-stone-400">{days[i]}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-xl p-3 text-center"><div className="text-2xl font-bold text-emerald-600">92%</div><div className="text-xs text-stone-500">{t('tutorial.demo.completionRate', 'Completion Rate')}</div></Card>
        <Card className="rounded-xl p-3 text-center"><div className="text-2xl font-bold text-amber-600">7</div><div className="text-xs text-stone-500">{t('tutorial.demo.dayStreak', 'Day Streak')}</div></Card>
        <Card className="rounded-xl p-3 text-center"><div className="text-2xl font-bold text-blue-600">156</div><div className="text-xs text-stone-500">{t('tutorial.demo.totalWaterings', 'Total Waterings')}</div></Card>
        <Card className="rounded-xl p-3 text-center"><div className="text-2xl font-bold text-purple-600">12</div><div className="text-xs text-stone-500">{t('tutorial.demo.activePlants', 'Active Plants')}</div></Card>
      </div>
    </div>
  )
}

function DemoTasksTab() {
  const { t } = useTranslation('common')
  const tasks = [
    { name: t('tutorial.demo.waterMonstera', 'Water Monstera'), icon: Droplets, color: 'text-blue-500', done: true },
    { name: t('tutorial.demo.waterSnakePlant', 'Water Snake Plant'), icon: Droplets, color: 'text-blue-500', done: true },
    { name: t('tutorial.demo.fertilizeLavender', 'Fertilize Lavender'), icon: Leaf, color: 'text-emerald-500', done: true },
    { name: t('tutorial.demo.pruneBasil', 'Prune Basil'), icon: Scissors, color: 'text-orange-500', done: false },
    { name: t('tutorial.demo.checkOrchid', 'Check Orchid'), icon: Sparkles, color: 'text-purple-500', done: false },
  ]
  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <Card key={i} className="rounded-xl p-3 flex items-center gap-3">
          <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center text-xs",
            task.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300 dark:border-stone-600"
          )}>{task.done && '✓'}</div>
          <task.icon className={cn("h-4 w-4", task.color)} />
          <span className={cn("flex-1 text-sm", task.done && "line-through text-stone-400")}>{task.name}</span>
        </Card>
      ))}
    </div>
  )
}

function DemoSeedlingTab() {
  const stages = ['🌱', '🌱', '🌿', '🌿', '', '🌱', '', '', '🌱', '🌿', '', '']
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {stages.map((s, i) => (
          <div key={i} className={cn(
            "aspect-square rounded-lg border flex items-center justify-center text-lg",
            s ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
          )}>{s}</div>
        ))}
      </div>
    </div>
  )
}

export function TutorialDemoPage({ step }: { step: TutorialStep }) {
  const page = step.demoPage

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-stone-100 to-stone-200 dark:from-[#252526] dark:to-[#1e1e1e] overflow-y-auto">
      <div className="max-w-lg mx-auto">
        {page === 'discovery' && <DemoDiscovery />}
        {page === 'encyclopedia' && <DemoEncyclopedia />}
        {page === 'scan' && <DemoScan />}
        {page === 'gardens' && <DemoGardens />}
        {page === 'garden-dashboard' && <DemoGardenDashboard stepId={step.id} />}
      </div>
    </div>
  )
}
