import React, { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Utensils, Clock, Zap, Flame, ChefHat } from 'lucide-react'
import type { PlantRecipe } from '@/types/plant'

/* ═══════════════════════════════════════════════════════════════════════════
   Category / time config
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

const OVERLAP      = 32
const DIVIDER_BODY = 54
const TAB_HEIGHT   = 32
const TAB_GAP      = 6     // gap between consecutive tabs
const TAB_PAD_X    = 28    // approximate horizontal padding inside a tab (px + icon + gaps)
const CHAR_WIDTH   = 7.5   // approximate width per character in the label
const TAB_START    = 10    // left margin for the first tab

/* ═══════════════════════════════════════════════════════════════════════════
   Compute tab positions — front (last index) starts left, wraps on overflow
   ═══════════════════════════════════════════════════════════════════════════ */

interface TabLayout { left: number; width: number }

function computeTabPositions(
  labels: string[],
  containerWidth: number,
): TabLayout[] {
  // Estimate each tab's width from its label
  const widths = labels.map(label => Math.ceil(TAB_PAD_X + label.length * CHAR_WIDTH))

  // We position in *visual order*: front tab (last index) first (leftmost),
  // then progressively to the right for back tabs (lower indices).
  // Build a visual-order array of { origIndex, width }.
  const visualOrder = widths
    .map((w, i) => ({ origIndex: i, width: w }))
    .reverse() // front-most (highest index) comes first

  const positions: TabLayout[] = new Array(labels.length)
  let cursor = TAB_START
  const maxRight = containerWidth - TAB_START

  for (const item of visualOrder) {
    // Would this tab overflow? Wrap to next "row" (reset cursor)
    if (cursor + item.width > maxRight && cursor > TAB_START) {
      cursor = TAB_START
    }
    positions[item.origIndex] = { left: cursor, width: item.width }
    cursor += item.width + TAB_GAP
  }

  return positions
}

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
  const cavityRef = useRef<HTMLDivElement>(null)
  const [cavityWidth, setCavityWidth] = useState(600)

  // Measure cavity width for tab positioning
  useLayoutEffect(() => {
    const el = cavityRef.current
    if (!el) return
    const update = () => setCavityWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const labels = useMemo(
    () => tabs.map(t => categoryLabels?.[t.key] || t.meta.label),
    [tabs, categoryLabels],
  )

  const tabPositions = useMemo(
    () => computeTabPositions(labels, cavityWidth),
    [labels, cavityWidth],
  )

  const openTab = useMemo(
    () => (openKey ? tabs.find(t => t.key === openKey) : null) ?? null,
    [openKey, tabs],
  )

  if (!tabs.length) return null

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-xl bg-amber-600/15 p-2.5 dark:bg-amber-500/20">
          <ChefHat className="h-6 w-6 sm:h-7 sm:w-7 text-amber-800 dark:text-amber-300" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">{title}</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Recipe card — appears ABOVE the box ────────────────────────── */}
      <AnimatePresence mode="wait">
        {openTab && (
          <motion.div
            key={openTab.key}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="mb-4"
          >
            <RecipeCard
              recipes={openTab.recipes}
              categoryLabel={categoryLabels?.[openTab.key] || openTab.meta.label}
              categoryIcon={openTab.meta.icon}
              timeLabels={timeLabels}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
          padding: '14px 14px 16px',
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
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl opacity-20"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(255,220,160,.6), transparent 60%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/0 dark:bg-black/40" />

        {/* Inner cavity */}
        <div
          ref={cavityRef}
          className="relative rounded-xl sm:rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, #9a7448 0%, #86633a 100%)',
            boxShadow: '0 3px 8px 0 rgba(0,0,0,.4) inset, 0 -1px 0 0 rgba(255,255,255,.06) inset',
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl bg-black/0 dark:bg-black/45" />

          {/* Divider stack */}
          <div className="relative px-2.5 sm:px-3 pb-3" style={{ paddingTop: TAB_HEIGHT + 10 }}>
            {tabs.map((tab, index) => (
              <Divider
                key={tab.key}
                tab={tab}
                index={index}
                isActive={openKey === tab.key}
                isFirst={index === 0}
                tabLeft={tabPositions[index]?.left ?? 10}
                categoryLabel={categoryLabels?.[tab.key]}
                onToggle={() => setOpenKey(prev => (prev === tab.key ? null : tab.key))}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 h-6 rounded-b-xl bg-gradient-to-t from-black/12 to-transparent" />
      </div>

      {/* Ground shadow */}
      <div className="pointer-events-none mx-auto mt-2 h-5 w-[85%] rounded-full bg-black/12 dark:bg-black/25 blur-xl" />
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   <Divider />
   ═══════════════════════════════════════════════════════════════════════════ */

function Divider({
  tab,
  index,
  isActive,
  isFirst,
  tabLeft,
  categoryLabel,
  onToggle,
}: {
  tab: { key: string; meta: { label: string; icon: string }; recipes: PlantRecipe[] }
  index: number
  isActive: boolean
  isFirst: boolean
  tabLeft: number
  categoryLabel?: string
  onToggle: () => void
}) {
  const label = categoryLabel || tab.meta.label

  const lightness     = 76 - index * 1.8
  const darkLightness = 26 - index * 1.2

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      className="relative"
      style={{
        marginTop: isFirst ? 0 : -OVERLAP,
        zIndex: index + 1,
      }}
    >
      {/* Tab */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute cursor-pointer group"
        style={{ left: tabLeft, top: -TAB_HEIGHT + 3, height: TAB_HEIGHT, zIndex: 2 }}
      >
        <div
          className="relative h-full rounded-t-lg px-3 sm:px-4 flex items-center gap-2 select-none whitespace-nowrap transition-all duration-150 group-hover:brightness-110"
          style={{
            background: isActive
              ? `linear-gradient(180deg, hsl(32 40% ${lightness + 6}%) 0%, hsl(30 36% ${lightness + 2}%) 100%)`
              : `linear-gradient(180deg, hsl(32 36% ${lightness + 3}%) 0%, hsl(30 32% ${lightness}%) 100%)`,
            boxShadow:
              '0 -3px 8px -2px rgba(60,36,12,.22),' +
              '0 1px 0 0 rgba(255,255,255,.14) inset',
            border: `1px solid hsl(30 24% ${lightness - 12}%)`,
            borderBottom: 'none',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-t-lg hidden dark:block"
            style={{
              background: isActive
                ? `linear-gradient(180deg, hsl(32 18% ${darkLightness + 8}%) 0%, hsl(30 16% ${darkLightness + 3}%) 100%)`
                : `linear-gradient(180deg, hsl(32 16% ${darkLightness + 5}%) 0%, hsl(30 14% ${darkLightness}%) 100%)`,
              border: `1px solid hsl(30 12% ${darkLightness + 10}%)`,
              borderBottom: 'none',
            }}
          />
          <span className="relative text-sm sm:text-base leading-none">{tab.meta.icon}</span>
          <span className="relative text-xs sm:text-sm font-semibold tracking-wide">
            <span className="dark:hidden" style={{ color: `hsl(28 42% ${isActive ? 18 : 24}%)` }}>{label}</span>
            <span className="hidden dark:inline" style={{ color: `hsl(32 18% ${isActive ? 80 : 70}%)` }}>{label}</span>
          </span>
          {isActive && (
            <span className="relative w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `hsl(32 50% ${lightness - 20}%)` }}>
              <span className="absolute inset-0 rounded-full hidden dark:block" style={{ background: 'hsl(32 30% 60%)' }} />
            </span>
          )}
        </div>
      </button>

      {/* Divider body */}
      <button
        type="button"
        onClick={onToggle}
        className="relative w-full text-left cursor-pointer group block"
        style={{ height: DIVIDER_BODY }}
      >
        <div
          className="absolute inset-0 rounded-lg sm:rounded-xl transition-all duration-150 group-hover:brightness-[1.04]"
          style={{
            background: isActive
              ? `linear-gradient(178deg, hsl(32 38% ${lightness + 4}%) 0%, hsl(30 34% ${lightness}%) 100%)`
              : `linear-gradient(178deg, hsl(32 34% ${lightness + 1}%) 0%, hsl(30 30% ${lightness - 2}%) 100%)`,
            border: `1px solid hsl(30 22% ${lightness - 14}%)`,
            boxShadow: isActive
              ? '0 6px 18px -4px rgba(50,30,10,.45), 0 1px 0 0 rgba(255,255,255,.12) inset, 0 -1px 2px 0 rgba(0,0,0,.08) inset'
              : '0 4px 12px -4px rgba(50,30,10,.35), 0 1px 0 0 rgba(255,255,255,.1) inset, 0 -1px 2px 0 rgba(0,0,0,.08) inset',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl hidden dark:block"
            style={{
              background: isActive
                ? `linear-gradient(178deg, hsl(32 16% ${darkLightness + 5}%) 0%, hsl(30 14% ${darkLightness + 1}%) 100%)`
                : `linear-gradient(178deg, hsl(32 14% ${darkLightness + 2}%) 0%, hsl(30 12% ${darkLightness - 1}%) 100%)`,
              border: `1px solid hsl(30 10% ${darkLightness + 8}%)`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl opacity-[.035] dark:opacity-[.05]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.65\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E")',
            }}
          />
        </div>
      </button>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   <RecipeCard />
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
        className="relative overflow-hidden rounded-xl sm:rounded-2xl"
        style={{
          background: 'linear-gradient(174deg, #f7f0e2 0%, #efe6d4 60%, #eae0cc 100%)',
          boxShadow:
            '0 12px 28px -6px rgba(40,24,8,.22),' +
            '0 3px 6px rgba(40,24,8,.08),' +
            '0 1px 0 0 rgba(255,250,240,.6) inset',
          border: '1px solid #d8cab0',
        }}
      >
        {/* Dark mode */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl hidden dark:block"
          style={{
            background: 'linear-gradient(174deg, hsl(38 14% 18%) 0%, hsl(34 12% 15%) 100%)',
            border: '1px solid hsl(34 10% 26%)',
          }}
        />

        {/* Ruled lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[.09] dark:opacity-[.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, transparent, transparent 31px, #a08060 31px, #a08060 32px)',
            backgroundPositionY: '15px',
          }}
        />

        {/* Red margin line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 opacity-[.12] dark:opacity-[.06]"
          style={{ left: 42, width: 1, background: '#c44' }}
        />

        {/* Light spot */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-[.08]"
          style={{
            backgroundImage: 'radial-gradient(ellipse 60% 40% at 12% 8%, rgba(255,255,255,.5), transparent 50%)',
          }}
        />

        <div className="relative px-5 sm:px-7 py-4 sm:py-5">
          {/* Category heading */}
          <div className="flex items-center gap-2.5 mb-3 pl-4">
            <span className="text-lg sm:text-xl">{categoryIcon}</span>
            <span className="text-sm sm:text-base font-bold uppercase tracking-[.1em] text-amber-900/60 dark:text-amber-300/50">
              {categoryLabel}
            </span>
          </div>

          {/* Recipe list */}
          <div className="space-y-0.5">
            {recipes.map((recipe, idx) => {
              const timeMeta = TIME_META[recipe.time]
              const resolvedTimeLabel = timeLabels?.[recipe.time] || timeMeta?.label
              const TimeIcon = timeMeta?.Icon

              return (
                <div
                  key={`${recipe.name}-${idx}`}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 pl-5 -mx-1 transition-colors hover:bg-amber-900/[.04] dark:hover:bg-white/[.05]"
                >
                  <Utensils className="h-4 w-4 shrink-0 text-amber-700/35 dark:text-amber-400/25" />

                  {recipe.link ? (
                    <a
                      href={recipe.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-base sm:text-lg font-medium text-stone-800 dark:text-stone-200 underline decoration-stone-300/50 dark:decoration-stone-600 underline-offset-4 hover:decoration-amber-600 dark:hover:decoration-amber-400 transition-colors truncate"
                    >
                      {recipe.name}
                    </a>
                  ) : (
                    <span className="flex-1 min-w-0 text-base sm:text-lg font-medium text-stone-800 dark:text-stone-200 truncate">
                      {recipe.name}
                    </span>
                  )}

                  {resolvedTimeLabel && (
                    <span className="inline-flex items-center gap-1 shrink-0 text-xs font-semibold rounded-md px-2 py-1 bg-amber-900/[.06] dark:bg-white/[.07] text-stone-500 dark:text-stone-400">
                      {TimeIcon && <TimeIcon className="h-3 w-3" />}
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
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Drop shadow */}
      <div className="pointer-events-none absolute -bottom-2.5 left-5 right-5 h-4 rounded-full bg-black/10 dark:bg-black/22 blur-xl" />
    </div>
  )
}
