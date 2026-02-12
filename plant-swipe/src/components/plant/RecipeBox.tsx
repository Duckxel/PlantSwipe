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

/** Visible part of each stacked divider (the strip peeking out above the one in front) */
const DIVIDER_PEEK  = 36
/** Full height of a divider body (the bottom card area) */
const DIVIDER_BODY  = 48
/** How tall each tab sticking up is */
const TAB_HEIGHT    = 28

/* ═══════════════════════════════════════════════════════════════════════════
   <RecipeBox />  –  main export
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

  /** Height needed for the stacked dividers (without any card expanded) */
  const stackHeight = DIVIDER_BODY + (tabs.length - 1) * DIVIDER_PEEK + TAB_HEIGHT

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-xl bg-amber-600/15 p-2.5 dark:bg-amber-500/20">
          <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-amber-800 dark:text-amber-300" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h3>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Wooden box ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl sm:rounded-3xl" style={{ perspective: '900px' }}>

        {/* Box outer shell */}
        <div
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(176deg, #a37c52 0%, #8b6840 30%, #7a5c38 70%, #6b5030 100%)',
            boxShadow:
              '0 2px 0 0 #b8935f inset,' +          /* top bevel highlight */
              '0 -1px 0 0 #4a3520 inset,' +          /* bottom bevel dark   */
              '0 28px 50px -14px rgba(40,22,8,.55),' + /* deep drop shadow    */
              '0 8px 16px -4px rgba(40,22,8,.3)',      /* near shadow         */
            padding: '12px 12px 14px',
          }}
        >
          {/* Wood grain texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[.07]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(95deg, transparent 0px, transparent 11px, rgba(0,0,0,.35) 11px, rgba(0,0,0,.35) 12px, transparent 12px, transparent 28px, rgba(0,0,0,.2) 28px, rgba(0,0,0,.2) 29px)',
            }}
          />
          {/* Warm highlight wash */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(255,220,160,.6), transparent 60%)',
            }}
          />
          {/* Bottom inner shadow (depth inside the box) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/20 to-transparent" />

          {/* Dark mode darken overlay */}
          <div className="pointer-events-none absolute inset-0 bg-black/0 dark:bg-black/40 rounded-2xl sm:rounded-3xl" />

          {/* ── Inner cavity (the inside of the box) ───────────────────────── */}
          <div
            className="relative rounded-xl sm:rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #9a7448 0%, #86633a 100%)',
              boxShadow:
                '0 2px 6px 0 rgba(0,0,0,.35) inset,' + /* top inner shadow */
                '0 -1px 0 0 rgba(255,255,255,.06) inset',
              minHeight: stackHeight,
            }}
          >
            {/* Dark mode cavity */}
            <div className="pointer-events-none absolute inset-0 bg-black/0 dark:bg-black/45 rounded-xl sm:rounded-2xl" />

            {/* ── Divider stack ──────────────────────────────────────────── */}
            <div className="relative" style={{ minHeight: stackHeight }}>
              {tabs.map((tab, index) => {
                const isOpen = openKey === tab.key
                return (
                  <Divider
                    key={tab.key}
                    tab={tab}
                    index={index}
                    isOpen={isOpen}
                    categoryLabel={categoryLabels?.[tab.key]}
                    timeLabels={timeLabels}
                    onToggle={() => setOpenKey(prev => (prev === tab.key ? null : tab.key))}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* Ground shadow under the box */}
        <div className="pointer-events-none mx-auto mt-2 h-4 w-[85%] rounded-full bg-black/10 dark:bg-black/20 blur-xl" />
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   <Divider />  –  one kraft-paper file divider
   ═══════════════════════════════════════════════════════════════════════════ */

function Divider({
  tab,
  index,
  isOpen,
  categoryLabel,
  timeLabels,
  onToggle,
}: {
  tab: { key: string; meta: { label: string; icon: string }; recipes: PlantRecipe[] }
  index: number
  isOpen: boolean
  categoryLabel?: string
  timeLabels?: Record<string, string>
  onToggle: () => void
}) {
  const label = categoryLabel || tab.meta.label

  /* Each divider is position: absolute inside the stack.
     The back-most (index 0) is at the top; the front-most (last) at the bottom.
     z-index grows with index so the front divider covers the back ones. */
  const topOffset = index * DIVIDER_PEEK

  /* Slight brightness variation to separate layers visually */
  const lightness = 72 - index * 1.2         // kraft gets slightly darker toward front
  const darkLightness = 22 - index * 0.8

  /* Stagger the tab horizontal position so all tabs stay visible */
  const tabLeft = 16 + index * 26

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      className="absolute left-0 right-0"
      style={{
        top: topOffset,
        zIndex: index + 1,
      }}
    >
      {/* ── Clickable tab (sticking up) ────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute cursor-pointer group"
        style={{
          left: tabLeft,
          top: -TAB_HEIGHT + 4,       /* tab overlaps divider body slightly */
          height: TAB_HEIGHT,
          zIndex: 10,
        }}
      >
        <div
          className="relative h-full rounded-t-lg px-3 sm:px-3.5 flex items-center gap-1.5 select-none transition-[filter] duration-150 group-hover:brightness-105"
          style={{
            background: `linear-gradient(180deg, hsl(32 36% ${lightness + 3}%) 0%, hsl(30 32% ${lightness}%) 100%)`,
            boxShadow:
              `0 -3px 6px -2px rgba(60,36,12,.25),` +   /* shadow behind tab */
              `0 1px 0 0 rgba(255,255,255,.12) inset`,    /* top bevel         */
            border: '1px solid',
            borderBottomColor: 'transparent',
            borderColor: `hsl(30 24% ${lightness - 12}%)`,
            borderBottomWidth: 0,
          }}
        >
          {/* Dark mode overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-t-lg hidden dark:block"
            style={{
              background: `linear-gradient(180deg, hsl(32 16% ${darkLightness + 4}%) 0%, hsl(30 14% ${darkLightness}%) 100%)`,
              border: '1px solid',
              borderBottomWidth: 0,
              borderColor: `hsl(30 12% ${darkLightness + 8}%)`,
            }}
          />
          <span className="relative text-xs sm:text-sm leading-none">{tab.meta.icon}</span>
          <span
            className="relative truncate text-[11px] sm:text-xs font-semibold tracking-wide max-w-[120px] sm:max-w-[160px]"
            style={{ color: `hsl(28 40% 24%)` }}
          >
            <span className="dark:hidden">{label}</span>
            <span className="hidden dark:inline" style={{ color: `hsl(32 18% 70%)` }}>{label}</span>
          </span>
        </div>
      </button>

      {/* ── Divider body (kraft card) ──────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="relative w-full text-left cursor-pointer group"
        style={{ height: DIVIDER_BODY }}
      >
        <div
          className="absolute inset-0 rounded-lg sm:rounded-xl transition-[filter] duration-150 group-hover:brightness-[1.03]"
          style={{
            background: `linear-gradient(178deg, hsl(32 34% ${lightness + 1}%) 0%, hsl(30 30% ${lightness - 2}%) 100%)`,
            border: '1px solid',
            borderColor: `hsl(30 22% ${lightness - 14}%)`,
            boxShadow:
              `0 4px 12px -4px rgba(50,30,10,.3),` +        /* drop shadow     */
              `0 1px 0 0 rgba(255,255,255,.1) inset,` +      /* top bevel       */
              `0 -1px 2px 0 rgba(0,0,0,.1) inset`,           /* bottom crease   */
          }}
        >
          {/* Dark mode overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl hidden dark:block"
            style={{
              background: `linear-gradient(178deg, hsl(32 14% ${darkLightness + 2}%) 0%, hsl(30 12% ${darkLightness - 1}%) 100%)`,
              border: '1px solid',
              borderColor: `hsl(30 10% ${darkLightness + 6}%)`,
            }}
          />

          {/* Kraft fibre texture */}
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl opacity-[.04] dark:opacity-[.06]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.65\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E")',
            }}
          />
        </div>
      </button>

      {/* ── Recipe card that slides out ────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="card"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="overflow-hidden relative"
            style={{ zIndex: 50 }}
          >
            <div className="pt-1 pb-2 px-1">
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
   <RecipeCard />  –  the recipe index card that pops out
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
      {/* Card */}
      <div
        className="relative overflow-hidden rounded-lg sm:rounded-xl"
        style={{
          background: 'linear-gradient(174deg, #f5edde 0%, #ede3d0 60%, #e8dcc8 100%)',
          boxShadow:
            '0 10px 24px -6px rgba(40,24,8,.28),' +
            '0 2px 4px rgba(40,24,8,.12),' +
            '0 1px 0 0 rgba(255,248,235,.5) inset',
          border: '1px solid #d4c4a8',
        }}
      >
        {/* Dark mode */}
        <div
          className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl hidden dark:block"
          style={{
            background: 'linear-gradient(174deg, hsl(38 14% 17%) 0%, hsl(34 12% 14%) 100%)',
            border: '1px solid hsl(34 10% 24%)',
          }}
        />

        {/* Ruled lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[.12] dark:opacity-[.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, transparent, transparent 27px, #a08060 27px, #a08060 28px)',
            backgroundPositionY: '14px',
          }}
        />

        {/* Red margin line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 opacity-[.14] dark:opacity-[.08]"
          style={{ left: 36, width: 1, background: '#c44' }}
        />

        {/* Top-left subtle light */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-10"
          style={{
            backgroundImage: 'radial-gradient(ellipse 60% 40% at 15% 10%, rgba(255,255,255,.6), transparent 50%)',
          }}
        />

        <div className="relative px-4 sm:px-5 py-3.5 sm:py-4">
          {/* Category heading */}
          <div className="flex items-center gap-2 mb-2.5 pl-6">
            <span className="text-sm sm:text-base">{categoryIcon}</span>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[.12em] text-amber-800/70 dark:text-amber-300/60">
              {categoryLabel}
            </span>
          </div>

          {/* Recipes */}
          <div className="space-y-0.5">
            {recipes.map((recipe, idx) => {
              const timeMeta = TIME_META[recipe.time]
              const resolvedTimeLabel = timeLabels?.[recipe.time] || timeMeta?.label
              const TimeIcon = timeMeta?.Icon

              return (
                <div
                  key={`${recipe.name}-${idx}`}
                  className="group flex items-center gap-2.5 rounded-md px-2 py-[7px] pl-6 -mx-0.5 transition-colors hover:bg-amber-900/[.04] dark:hover:bg-white/[.04]"
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
      <div className="pointer-events-none absolute -bottom-2 left-4 right-4 h-4 rounded-full bg-black/10 dark:bg-black/20 blur-lg" />
    </div>
  )
}
