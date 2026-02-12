import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Utensils, Clock, Zap, Flame, ChefHat } from 'lucide-react'
import type { PlantRecipe } from '@/types/plant'

/* ═══════════════════════════════════════════════════════════════════════════
   Category / time metadata
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_ORDER = [
  'breakfast_brunch', 'starters_appetizers', 'soups_salads', 'main_courses',
  'side_dishes', 'desserts', 'drinks', 'other',
] as const

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  breakfast_brunch:    { label: 'Breakfast & Brunch',    icon: '\u2615'              },
  starters_appetizers: { label: 'Starters & Appetizers', icon: '\uD83E\uDD57'       },
  soups_salads:        { label: 'Soups & Salads',        icon: '\uD83E\uDD63'       },
  main_courses:        { label: 'Main Courses',          icon: '\uD83C\uDF7D\uFE0F' },
  side_dishes:         { label: 'Side Dishes',           icon: '\uD83E\uDD66'       },
  desserts:            { label: 'Desserts',              icon: '\uD83C\uDF70'       },
  drinks:              { label: 'Drinks',                icon: '\uD83C\uDF79'       },
  other:               { label: 'Other',                 icon: '\uD83C\uDF74'       },
}

const TIME_META: Record<string, { label: string; Icon: React.FC<{ className?: string }> }> = {
  quick:        { label: 'Quick',   Icon: Zap   },
  '30_plus':    { label: '30+ min', Icon: Clock },
  slow_cooking: { label: 'Slow',    Icon: Flame },
}

/* ═══════════════════════════════════════════════════════════════════════════
   Layout constants
   ═══════════════════════════════════════════════════════════════════════════ */

/** How much each divider overlaps the one behind it (negative margin) */
const OVERLAP      = 28
/** Height of the divider body */
const DIVIDER_BODY = 48
/** Height of the tab that sticks up */
const TAB_HEIGHT   = 26

/* ═══════════════════════════════════════════════════════════════════════════
   <RecipeBox />
   ═══════════════════════════════════════════════════════════════════════════ */

interface RecipeBoxProps {
  recipes: PlantRecipe[]
  categoryLabels?: Record<string, string>
  timeLabels?: Record<string, string>
  title?: string
  subtitle?: string
}

export function RecipeBox({
  recipes,
  categoryLabels,
  timeLabels,
  title = 'Recipe Ideas',
  subtitle = 'Culinary inspiration for this plant',
}: RecipeBoxProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const tabs = useMemo(() => {
    const grouped: Record<string, PlantRecipe[]> = {}
    for (const r of recipes) {
      const cat = r.category || 'other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(r)
    }
    return CATEGORY_ORDER
      .filter(cat => grouped[cat]?.length)
      .map(cat => ({
        key: cat,
        meta: CATEGORY_META[cat] || CATEGORY_META.other,
        recipes: grouped[cat],
      }))
  }, [recipes])

  if (!tabs.length) return null

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-xl bg-amber-600/15 p-2.5 dark:bg-amber-500/20">
          <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-amber-800 dark:text-amber-300" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h3>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Wooden box ─────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl sm:rounded-3xl"
        style={{
          background: 'linear-gradient(176deg, #a37c52 0%, #8b6840 30%, #7a5c38 70%, #6b5030 100%)',
          boxShadow:
            '0 2px 0 0 #b8935f inset,' +
            '0 -1px 0 0 #4a3520 inset,' +
            '0 28px 50px -14px rgba(40,22,8,.55),' +
            '0 8px 16px -4px rgba(40,22,8,.3)',
          padding: '12px 12px 14px',
        }}
      >
        {/* Wood grain */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl opacity-[.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(95deg, transparent 0px, transparent 11px, rgba(0,0,0,.35) 11px, rgba(0,0,0,.35) 12px, transparent 12px, transparent 28px, rgba(0,0,0,.2) 28px, rgba(0,0,0,.2) 29px)',
          }}
        />
        {/* Warm highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl opacity-20"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(255,220,160,.6), transparent 60%)',
          }}
        />
        {/* Dark mode overlay on box */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/0 dark:bg-black/40" />

        {/* ── Inner cavity ──────────────────────────────────────────── */}
        <div
          className="relative rounded-xl sm:rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, #9a7448 0%, #86633a 100%)',
            boxShadow: '0 2px 6px 0 rgba(0,0,0,.35) inset, 0 -1px 0 0 rgba(255,255,255,.06) inset',
          }}
        >
          {/* Dark mode cavity */}
          <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl bg-black/0 dark:bg-black/45" />

          {/* Padding inside cavity -- top needs extra room for the first tab */}
          <div className="relative px-2 sm:px-3 pb-2 sm:pb-3" style={{ paddingTop: TAB_HEIGHT + 8 }}>
            {/* ── Divider stack (normal flow, negative margins for overlap) ── */}
            {tabs.map((tab, index) => {
              const isOpen = openKey === tab.key
              return (
                <Divider
                  key={tab.key}
                  tab={tab}
                  index={index}
                  isOpen={isOpen}
                  isFirst={index === 0}
                  categoryLabel={categoryLabels?.[tab.key]}
                  timeLabels={timeLabels}
                  onToggle={() => setOpenKey(prev => (prev === tab.key ? null : tab.key))}
                />
              )
            })}
          </div>
        </div>

        {/* Bottom inner shadow */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 h-6 rounded-b-xl bg-gradient-to-t from-black/15 to-transparent" />
      </div>

      {/* Ground shadow */}
      <div className="pointer-events-none mx-auto mt-2 h-4 w-[85%] rounded-full bg-black/10 dark:bg-black/20 blur-xl" />
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   <Divider />  –  one kraft-paper file divider (normal flow)
   ═══════════════════════════════════════════════════════════════════════════ */

function Divider({
  tab,
  index,
  isOpen,
  isFirst,
  categoryLabel,
  timeLabels,
  onToggle,
}: {
  tab: { key: string; meta: { label: string; icon: string }; recipes: PlantRecipe[] }
  index: number
  isOpen: boolean
  isFirst: boolean
  categoryLabel?: string
  timeLabels?: Record<string, string>
  onToggle: () => void
}) {
  const label = categoryLabel || tab.meta.label

  /* Kraft lightness varies per layer -- back is lighter, front darker */
  const lightness     = 74 - index * 1.5
  const darkLightness = 24 - index * 1

  /* Stagger tab position horizontally */
  const tabLeft = 12 + index * 28

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      className="relative"
      style={{
        /* Overlap: each divider (except the first) pulls upward into the one behind it */
        marginTop: isFirst ? 0 : -OVERLAP,
        /* Front dividers sit above back dividers */
        zIndex: index + 1,
      }}
    >
      {/* ── Tab sticking up ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute cursor-pointer group"
        style={{
          left: tabLeft,
          top: -TAB_HEIGHT + 2,
          height: TAB_HEIGHT,
          zIndex: 2,
        }}
      >
        <div
          className="relative h-full rounded-t-lg px-2.5 sm:px-3 flex items-center gap-1.5 select-none transition-[filter] duration-150 group-hover:brightness-110"
          style={{
            background: `linear-gradient(180deg, hsl(32 36% ${lightness + 3}%) 0%, hsl(30 32% ${lightness}%) 100%)`,
            boxShadow:
              '0 -2px 5px -1px rgba(60,36,12,.2),' +
              '0 1px 0 0 rgba(255,255,255,.12) inset',
            border: `1px solid hsl(30 24% ${lightness - 12}%)`,
            borderBottom: 'none',
          }}
        >
          {/* Dark mode tab overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-t-lg hidden dark:block"
            style={{
              background: `linear-gradient(180deg, hsl(32 16% ${darkLightness + 5}%) 0%, hsl(30 14% ${darkLightness}%) 100%)`,
              border: `1px solid hsl(30 12% ${darkLightness + 10}%)`,
              borderBottom: 'none',
            }}
          />
          <span className="relative text-xs sm:text-sm leading-none">{tab.meta.icon}</span>
          <span className="relative truncate text-[11px] sm:text-xs font-semibold tracking-wide max-w-[110px] sm:max-w-[150px]">
            <span className="dark:hidden" style={{ color: `hsl(28 42% 22%)` }}>{label}</span>
            <span className="hidden dark:inline" style={{ color: `hsl(32 18% 72%)` }}>{label}</span>
          </span>
        </div>
      </button>

      {/* ── Divider body ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="relative w-full text-left cursor-pointer group block"
        style={{ height: DIVIDER_BODY }}
      >
        <div
          className="absolute inset-0 rounded-lg sm:rounded-xl transition-[filter] duration-150 group-hover:brightness-[1.04]"
          style={{
            background: `linear-gradient(178deg, hsl(32 34% ${lightness + 1}%) 0%, hsl(30 30% ${lightness - 2}%) 100%)`,
            border: `1px solid hsl(30 22% ${lightness - 14}%)`,
            boxShadow:
              '0 4px 12px -4px rgba(50,30,10,.35),' +
              '0 1px 0 0 rgba(255,255,255,.1) inset,' +
              '0 -1px 2px 0 rgba(0,0,0,.08) inset',
          }}
        >
          {/* Dark mode body overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl hidden dark:block"
            style={{
              background: `linear-gradient(178deg, hsl(32 14% ${darkLightness + 2}%) 0%, hsl(30 12% ${darkLightness - 1}%) 100%)`,
              border: `1px solid hsl(30 10% ${darkLightness + 8}%)`,
            }}
          />

          {/* Kraft paper fibre texture */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl opacity-[.035] dark:opacity-[.05]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.65\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E")',
            }}
          />
        </div>
      </button>

      {/* ── Recipe card slides out below ────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="overflow-hidden relative"
            style={{ zIndex: 50 }}
          >
            <div className="pt-1.5 pb-1">
              <RecipeCard
                recipes={tab.recipes}
                categoryLabel={label}
                categoryIcon={tab.meta.icon}
                timeLabels={timeLabels}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   <RecipeCard />  –  ivory index card
   ═══════════════════════════════════════════════════════════════════════════ */

function RecipeCard({
  recipes,
  categoryLabel,
  categoryIcon,
  timeLabels,
}: {
  recipes: PlantRecipe[]
  categoryLabel: string
  categoryIcon: string
  timeLabels?: Record<string, string>
}) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-lg sm:rounded-xl"
        style={{
          background: 'linear-gradient(174deg, #f5edde 0%, #ede3d0 60%, #e8dcc8 100%)',
          boxShadow:
            '0 8px 20px -4px rgba(40,24,8,.25),' +
            '0 2px 4px rgba(40,24,8,.1),' +
            '0 1px 0 0 rgba(255,248,235,.5) inset',
          border: '1px solid #d4c4a8',
        }}
      >
        {/* Dark mode card */}
        <div
          className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl hidden dark:block"
          style={{
            background: 'linear-gradient(174deg, hsl(38 14% 17%) 0%, hsl(34 12% 14%) 100%)',
            border: '1px solid hsl(34 10% 24%)',
          }}
        />

        {/* Ruled lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[.1] dark:opacity-[.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, transparent, transparent 27px, #a08060 27px, #a08060 28px)',
            backgroundPositionY: '13px',
          }}
        />

        {/* Red margin line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 opacity-[.12] dark:opacity-[.06]"
          style={{ left: 36, width: 1, background: '#c44' }}
        />

        {/* Subtle light spot */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-8"
          style={{
            backgroundImage: 'radial-gradient(ellipse 60% 40% at 15% 10%, rgba(255,255,255,.5), transparent 50%)',
          }}
        />

        <div className="relative px-4 sm:px-5 py-3 sm:py-3.5">
          {/* Category heading */}
          <div className="flex items-center gap-2 mb-2 pl-6">
            <span className="text-sm sm:text-base">{categoryIcon}</span>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[.12em] text-amber-800/70 dark:text-amber-300/60">
              {categoryLabel}
            </span>
          </div>

          {/* Recipe list */}
          <div className="space-y-px">
            {recipes.map((recipe, idx) => {
              const timeMeta = TIME_META[recipe.time]
              const resolvedTimeLabel = timeLabels?.[recipe.time] || timeMeta?.label
              const TimeIcon = timeMeta?.Icon

              return (
                <div
                  key={`${recipe.name}-${idx}`}
                  className="group flex items-center gap-2 rounded-md px-2 py-[6px] pl-6 -mx-0.5 transition-colors hover:bg-amber-900/[.04] dark:hover:bg-white/[.04]"
                >
                  <Utensils className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-amber-700/40 dark:text-amber-400/30" />

                  {recipe.link ? (
                    <a
                      href={recipe.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-[13px] sm:text-sm font-medium text-stone-800 dark:text-stone-200 underline decoration-stone-300/60 dark:decoration-stone-600 underline-offset-2 hover:decoration-amber-600 dark:hover:decoration-amber-400 transition-colors truncate"
                    >
                      {recipe.name}
                    </a>
                  ) : (
                    <span className="flex-1 min-w-0 text-[13px] sm:text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                      {recipe.name}
                    </span>
                  )}

                  {resolvedTimeLabel && (
                    <span className="inline-flex items-center gap-0.5 shrink-0 text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-900/[.06] dark:bg-white/[.07] text-stone-500 dark:text-stone-400">
                      {TimeIcon && <TimeIcon className="h-2.5 w-2.5" />}
                      {resolvedTimeLabel}
                    </span>
                  )}

                  {recipe.link && (
                    <a
                      href={recipe.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-stone-400 hover:text-amber-700 dark:text-stone-500 dark:hover:text-amber-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Card drop shadow */}
      <div className="pointer-events-none absolute -bottom-2 left-4 right-4 h-3 rounded-full bg-black/10 dark:bg-black/20 blur-lg" />
    </div>
  )
}
