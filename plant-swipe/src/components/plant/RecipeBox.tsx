import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Utensils, Clock, Zap, Flame, ChefHat } from 'lucide-react'
import type { PlantRecipe } from '@/types/plant'

// ── Category config ──────────────────────────────────────────────────────────

interface CategoryMeta {
  label: string
  icon: string
  /** HSL hue used to derive all per-tab colours */
  hue: number
}

const CATEGORY_ORDER = [
  'breakfast_brunch',
  'starters_appetizers',
  'soups_salads',
  'main_courses',
  'side_dishes',
  'desserts',
  'drinks',
  'other',
] as const

const CATEGORY_META: Record<string, CategoryMeta> = {
  breakfast_brunch:    { label: 'Breakfast & Brunch',    icon: '\u2615',           hue: 38  },
  starters_appetizers: { label: 'Starters & Appetizers', icon: '\uD83E\uDD57',    hue: 80  },
  soups_salads:        { label: 'Soups & Salads',        icon: '\uD83E\uDD63',    hue: 150 },
  main_courses:        { label: 'Main Courses',          icon: '\uD83C\uDF7D\uFE0F', hue: 24  },
  side_dishes:         { label: 'Side Dishes',           icon: '\uD83E\uDD66',    hue: 170 },
  desserts:            { label: 'Desserts',              icon: '\uD83C\uDF70',    hue: 340 },
  drinks:              { label: 'Drinks',                icon: '\uD83C\uDF79',    hue: 200 },
  other:               { label: 'Other',                 icon: '\uD83C\uDF74',    hue: 30  },
}

const TIME_META: Record<string, { label: string; Icon: React.FC<{ className?: string }> }> = {
  quick:        { label: 'Quick',   Icon: Zap },
  '30_plus':    { label: '30+ min', Icon: Clock },
  slow_cooking: { label: 'Slow',    Icon: Flame },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate consistent colours from a hue */
function tabColors(hue: number) {
  return {
    bg:           `hsl(${hue} 30% 68%)`,
    bgHover:      `hsl(${hue} 34% 64%)`,
    headerBg:     `hsl(${hue} 34% 62%)`,
    border:       `hsl(${hue} 28% 54%)`,
    shadow:       `hsla(${hue} 40% 22% / .35)`,
    text:         `hsl(${hue} 50% 16%)`,
    darkBg:       `hsl(${hue} 22% 22%)`,
    darkHeaderBg: `hsl(${hue} 22% 26%)`,
    darkBorder:   `hsl(${hue} 18% 32%)`,
    darkShadow:   `hsla(${hue} 30% 8% / .55)`,
    darkText:     `hsl(${hue} 20% 82%)`,
  }
}

// ── Stack tuning ─────────────────────────────────────────────────────────────

const OVERLAP       = 46
const ROW_HEIGHT    = 56
const TAB_WIDTH_PX  = 220
const X_SHIFT       = 4

// ── Component ────────────────────────────────────────────────────────────────

interface RecipeBoxProps {
  recipes: PlantRecipe[]
  /** Category labels from i18n (key = db slug, value = translated label) */
  categoryLabels?: Record<string, string>
  /** Time labels from i18n (key = db slug, value = translated label) */
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
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Group recipes by category, keeping only populated ones in display order
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
    <section className="rounded-2xl sm:rounded-3xl overflow-visible">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-xl bg-amber-500/20 p-2 dark:bg-amber-500/30">
          <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-amber-700 dark:text-amber-300" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h3>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
        </div>
      </div>

      {/* Wooden box */}
      <div
        className="relative rounded-2xl sm:rounded-3xl overflow-visible"
        style={{
          background: 'linear-gradient(168deg, hsl(30 32% 52%) 0%, hsl(28 36% 44%) 40%, hsl(25 30% 38%) 100%)',
          boxShadow: '0 1px 0 0 hsl(30 30% 58%) inset, 0 24px 48px -12px rgba(0,0,0,.4), 0 4px 8px -2px rgba(0,0,0,.25)',
        }}
      >
        {/* Wood grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl opacity-[0.06]"
          style={{
            backgroundImage: 'repeating-linear-gradient(92deg, transparent, transparent 18px, rgba(0,0,0,.3) 18px, rgba(0,0,0,.3) 19px)',
          }}
        />
        {/* Top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-b from-white/10 to-transparent" />

        <div className="relative px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
          {/* Dark mode overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/0 dark:bg-black/30" />

          {/* Stack of tabs */}
          <div className="relative" style={{ paddingBottom: openIndex !== null ? 8 : 0 }}>
            {tabs.map((tab, index) => {
              const mt = index === 0 ? 0 : -OVERLAP
              const x = index * X_SHIFT
              const isOpen = openIndex === index

              return (
                <motion.div
                  key={tab.key}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035, duration: 0.35, ease: 'easeOut' }}
                  className="relative"
                  style={{
                    marginTop: mt,
                    transform: `translateX(${x}px)`,
                    zIndex: index + 1,
                  }}
                >
                  <FolderTab
                    tab={tab}
                    index={index}
                    isOpen={isOpen}
                    categoryLabel={categoryLabels?.[tab.key]}
                    timeLabels={timeLabels}
                    onClick={() => setOpenIndex(prev => (prev === index ? null : index))}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Bottom inner shadow */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl sm:rounded-b-3xl bg-gradient-to-t from-black/15 to-transparent" />
      </div>
    </section>
  )
}

// ── Folder Tab ───────────────────────────────────────────────────────────────

function FolderTab({
  tab,
  index,
  isOpen,
  categoryLabel,
  timeLabels,
  onClick,
}: {
  tab: { key: string; meta: CategoryMeta; recipes: PlantRecipe[] }
  index: number
  isOpen: boolean
  categoryLabel?: string
  timeLabels?: Record<string, string>
  onClick: () => void
}) {
  const c = tabColors(tab.meta.hue)
  const brightness = 1 - index * 0.015
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const label = categoryLabel || tab.meta.label

  return (
    <div className="relative w-full" style={{ filter: `brightness(${brightness})` }}>
      <button type="button" onClick={onClick} className="relative w-full text-left group cursor-pointer">
        <div
          className="relative rounded-xl sm:rounded-2xl"
          style={{
            height: ROW_HEIGHT,
            overflow: 'visible',
            background: isDark ? c.darkBg : c.bg,
            borderWidth: 1,
            borderColor: isDark ? c.darkBorder : c.border,
            boxShadow: `0 10px 20px -10px ${isDark ? c.darkShadow : c.shadow}, 0 1px 0 0 hsla(0 0% 100% / .08) inset`,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { if (!isDark) (e.currentTarget.style.background = c.bgHover) }}
          onMouseLeave={e => { if (!isDark) (e.currentTarget.style.background = c.bg) }}
        >
          {/* Tab header */}
          <div
            className="absolute -top-[22px] left-10 sm:left-14 h-[30px] rounded-t-xl sm:rounded-t-2xl flex items-center px-3 sm:px-4 gap-1.5"
            style={{
              width: TAB_WIDTH_PX,
              background: isDark ? c.darkHeaderBg : c.headerBg,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: isDark ? c.darkBorder : c.border,
              boxShadow: `0 -4px 10px -4px ${isDark ? c.darkShadow : c.shadow}, 0 1px 0 0 hsla(0 0% 100% / .12) inset`,
              zIndex: 30,
            }}
          >
            <span className="text-sm sm:text-base leading-none shrink-0">{tab.meta.icon}</span>
            <span
              className="truncate text-xs sm:text-[13px] font-semibold tracking-wide"
              style={{ color: isDark ? c.darkText : c.text }}
            >
              {label}
            </span>
            <span
              className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
              style={{
                background: isDark ? 'hsla(0 0% 100% / .1)' : 'hsla(0 0% 0% / .08)',
                color: isDark ? c.darkText : c.text,
              }}
            >
              {tab.recipes.length}
            </span>
          </div>

          {/* Subtle horizontal line on body */}
          <div
            className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-px opacity-20"
            style={{ background: isDark ? 'white' : 'black' }}
          />

          {/* Note card - appears inside divider so it sits between layers */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="note"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="absolute z-20"
                style={{
                  left: 24,
                  right: 24,
                  top: ROW_HEIGHT + 4,
                }}
              >
                <RecipeCard
                  recipes={tab.recipes}
                  categoryLabel={label}
                  categoryIcon={tab.meta.icon}
                  hue={tab.meta.hue}
                  timeLabels={timeLabels}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>

      {/* Expand height to contain note card when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="overflow-hidden"
          >
            {/* Invisible spacer that matches the note card height */}
            <div className="pt-2 pb-1">
              <div className="invisible">
                <RecipeCard
                  recipes={tab.recipes}
                  categoryLabel={label}
                  categoryIcon={tab.meta.icon}
                  hue={tab.meta.hue}
                  timeLabels={timeLabels}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Recipe Note Card ─────────────────────────────────────────────────────────

function RecipeCard({
  recipes,
  categoryLabel,
  categoryIcon,
  hue,
  timeLabels,
}: {
  recipes: PlantRecipe[]
  categoryLabel: string
  categoryIcon: string
  hue: number
  timeLabels?: Record<string, string>
}) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-xl sm:rounded-2xl"
        style={{
          background: 'linear-gradient(170deg, hsl(42 45% 93%) 0%, hsl(38 38% 88%) 100%)',
          boxShadow: '0 16px 32px -8px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.1), 0 1px 0 0 hsla(40 40% 96% / .6) inset',
          borderWidth: 1,
          borderColor: 'hsl(35 25% 78%)',
        }}
      >
        {/* Dark mode override */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl hidden dark:block"
          style={{
            background: 'linear-gradient(170deg, hsl(40 12% 16%) 0%, hsl(35 10% 13%) 100%)',
            borderColor: 'hsl(35 10% 24%)',
          }}
        />

        {/* Paper texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-15"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, transparent, transparent 23px, hsla(30 20% 50% / .15) 23px, hsla(30 20% 50% / .15) 24px)',
          }}
        />

        {/* Subtle light spot */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-10"
          style={{
            backgroundImage: 'radial-gradient(ellipse 70% 50% at 20% 15%, hsla(0 0% 100% / .5), transparent 60%)',
          }}
        />

        <div className="relative px-4 sm:px-5 py-3 sm:py-4">
          {/* Category label */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">{categoryIcon}</span>
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: `hsl(${hue} 35% 40%)` }}
            >
              <span className="dark:hidden">{categoryLabel}</span>
              <span className="hidden dark:inline" style={{ color: `hsl(${hue} 25% 65%)` }}>{categoryLabel}</span>
            </span>
          </div>

          {/* Recipe list */}
          <div className="space-y-1.5">
            {recipes.map((recipe, idx) => {
              const timeMeta = TIME_META[recipe.time]
              const resolvedTimeLabel = timeLabels?.[recipe.time] || timeMeta?.label
              const TimeIcon = timeMeta?.Icon

              return (
                <div
                  key={`${recipe.name}-${idx}`}
                  className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 -mx-1 transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
                >
                  <Utensils className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-stone-500" />

                  {recipe.link ? (
                    <a
                      href={recipe.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm sm:text-[15px] font-medium text-stone-800 dark:text-stone-200 underline decoration-stone-300 dark:decoration-stone-600 underline-offset-2 hover:decoration-stone-500 dark:hover:decoration-stone-400 transition-colors truncate"
                    >
                      {recipe.name}
                    </a>
                  ) : (
                    <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-medium text-stone-800 dark:text-stone-200 truncate">
                      {recipe.name}
                    </span>
                  )}

                  {/* Time badge */}
                  {resolvedTimeLabel && (
                    <span className="inline-flex items-center gap-1 shrink-0 text-[10px] sm:text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-black/[.05] dark:bg-white/[.08] text-stone-500 dark:text-stone-400">
                      {TimeIcon && <TimeIcon className="h-3 w-3" />}
                      {resolvedTimeLabel}
                    </span>
                  )}

                  {/* External link icon */}
                  {recipe.link && (
                    <a
                      href={recipe.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Note card drop shadow */}
      <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-5 rounded-full bg-black/15 dark:bg-black/30 blur-xl" />
    </div>
  )
}
