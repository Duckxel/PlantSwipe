# About Page - Complete Style & Component Guide

## Overview
The About Page is a modern, gradient-rich, animated single-page layout built with React, Tailwind CSS, and Framer Motion. It features a sophisticated dark/light mode system with emerald green accents and uses a card-based design system.

---

## COMPONENT TREE STRUCTURE

```
AboutPage (max-w-5xl container)
│
├── Hero Section (gradient card, rounded-[32px])
│   ├── Blur Orbs (decorative, absolute positioned)
│   ├── motion.div (animated container)
│   │   ├── Badge (eyebrow with Sparkles icon)
│   │   ├── motion.h1 (animated title)
│   │   ├── motion.p (animated subtitle)
│   │   └── motion.div (animated CTA buttons)
│   │       ├── Button (primary, rounded-2xl)
│   │       └── Button (outline variant, rounded-2xl)
│   │
├── Pillars Section
│   ├── Section Header (title + subtitle)
│   └── Card (rounded-[32px], two-column grid)
│       ├── Left Column (pillar cards)
│       │   └── Pillar Card (repeated)
│       │       ├── Icon Container (BookOpenCheck)
│       │       ├── Eyebrow Text
│       │       ├── CardTitle
│       │       └── Description (CardDescription OR Numbered List)
│       │           └── Numbered Item (if array)
│       │               ├── Circle Badge (number)
│       │               └── Text
│       │
│       └── Right Column (name origin)
│           ├── Icon Container (Leaf)
│           ├── Eyebrow + Title
│           ├── Description
│           └── Badge Chips (CalendarDays icon)
│
├── Services & Practical Section (two-column grid)
│   ├── Services Card (rounded-[28px])
│   │   ├── CardContent
│   │   │   ├── Header (PartyPopper icon + label)
│   │   │   ├── Subtitle
│   │   │   └── List (Leaf icons)
│   │   │       └── List Item (repeated)
│   │   │
│   └── Practical Card (rounded-[28px])
│       ├── CardContent
│       │   ├── Practical Info Section
│       │   │   ├── Header (MapPin icon + label)
│       │   │   ├── Description
│       │   │   ├── Badge (status)
│       │   │   └── Address Text
│       │   │
│       │   └── Collaboration Section (border-top divider)
│       │       ├── Header (HeartHandshake icon + label)
│       │       ├── Description
│       │       └── Button (rounded-2xl)
│   │
├── Meet the Team Section
│   ├── Section Header (title + subtitle + Badge)
│   └── Grid (2 columns, max-w-[600px])
│       └── Member Card (repeated, rounded-xl)
│           ├── Image Container (aspect-square, rounded-xl)
│           │   ├── Image (or Placeholder)
│           │   └── Tag Badge (overlay, absolute)
│           └── CardHeader (centered)
│               ├── CardTitle (name)
│               └── CardDescription (role)
│
└── Final CTA Section (rounded-[28px])
    ├── Radial Gradient Overlay (absolute)
    └── Content (flex layout)
        ├── Text Section
        │   ├── h2 (title)
        │   └── p (subtitle)
        └── Button (rounded-2xl)
```

---

## 1. LAYOUT STRUCTURE

### Container
- **Max Width**: `max-w-5xl` (1024px)
- **Centering**: `mx-auto` (horizontal centering)
- **Top Margin**: `mt-8`
- **Horizontal Padding**: `px-4 md:px-0` (16px on mobile, 0 on desktop)
- **Bottom Padding**: `pb-16` (64px)
- **Vertical Spacing**: `space-y-12` (48px between sections)

### Section Organization
The page consists of 5 main sections:
1. Hero Section (gradient background with blur effects)
2. Pillars Section (two-column card layout)
3. Services & Practical Info (two-column grid)
4. Meet the Team (member cards grid)
5. Final CTA Section (centered call-to-action)

---

## 2. COLOR SYSTEM

### Primary Color Palette
- **Emerald Green** (Primary Accent):
  - Light: `emerald-50`, `emerald-100`, `emerald-200`, `emerald-600`, `emerald-700`
  - Dark: `emerald-300`, `emerald-400`, `emerald-500`, `emerald-900`
  - HSL: `142 72% 40%` (accent variable)

### Neutral Colors (Stone Palette)
- **Light Mode**:
  - Background: `stone-50`, `stone-100`, `white`
  - Text: `stone-600`, `stone-700`, `stone-900`
  - Borders: `stone-200`
  
- **Dark Mode**:
  - Background: `#1e1e1e`, `#1f1f1f`, `#171717`, `#252526`, `#2d2d30`
  - Text: `stone-200`, `stone-300`, `stone-400`
  - Borders: `#3e3e42`

### CSS Variables (from index.css)
```css
/* Light Mode */
--background: 0 0% 100%
--foreground: 0 0% 3.9%
--card: 0 0% 100%
--border: 0 0% 89.8% (stone-200)
--accent: 142 72% 40% (emerald)

/* Dark Mode */
--background: 0 0% 12% (#1e1e1e)
--foreground: 0 0% 95%
--card: 240 3% 15% (#252526)
--border: 240 3% 25% (#3e3e42)
--accent: 142 72% 40% (emerald)
```

---

## 3. TYPOGRAPHY

### Font Stack
- **Primary**: System fonts (`system-ui, Avenir, Helvetica, Arial, sans-serif`)
- **Brand Font**: `"Lavonte"` (custom font, serif fallback)

### Font Sizes & Weights
- **H1 (Hero Title)**: `text-3xl md:text-4xl` (30px/36px), `font-semibold`, `tracking-tight`
- **H2 (Section Titles)**: `text-2xl` (24px), `font-semibold`
- **H3**: `text-lg` (18px), `font-semibold`
- **Body Text**: `text-base` (16px) or `text-sm` (14px)
- **Small Text**: `text-xs` (12px), `uppercase`, `tracking-wide`
- **Card Titles**: `text-xl` (20px) or `text-base` (16px)

### Text Colors
- **Primary Text**: `text-stone-900 dark:text-stone-100`
- **Secondary Text**: `text-stone-600 dark:text-stone-300`
- **Muted Text**: `text-stone-500 dark:text-stone-400`
- **Accent Text**: `text-emerald-600 dark:text-emerald-300` or `text-emerald-700 dark:text-emerald-200`

---

## 4. BORDER RADIUS SYSTEM

The page uses **large, rounded corners** for a modern, soft aesthetic:

- **Hero Section**: `rounded-[32px]` (128px radius)
- **Main Cards**: `rounded-[32px]` or `rounded-[28px]` (112px radius)
- **Buttons**: `rounded-2xl` (16px radius)
- **Badges**: `rounded-2xl` or `rounded-full` (pill shape)
- **Icon Containers**: `rounded-2xl` (16px radius)
- **Member Cards**: `rounded-xl` (12px radius)
- **Member Images**: `rounded-xl` (12px radius)
- **Numbered Circles**: `rounded-full` (perfect circle)

---

## 5. COMPONENTS BREAKDOWN

### A. Hero Section (Lines 70-118)

**Container**:
```tsx
className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]"
```

**Key Features**:
- **Gradient Background**: `bg-gradient-to-br` (bottom-right diagonal)
  - Light: `from-emerald-50 via-white to-stone-100`
  - Dark: `from-[#252526] via-[#1e1e1e] to-[#171717]`
- **Blur Orbs** (decorative background elements):
  - Top-right: `absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl`
  - Bottom-left: `absolute -left-16 bottom-[-30%] h-72 w-72 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 blur-3xl`
- **Padding**: `p-8 md:p-16` (32px/64px)

**Badge Component**:
```tsx
className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur flex items-center gap-2"
```
- **Glass Effect**: `backdrop-blur` with semi-transparent background
- **Icon**: `Sparkles` from lucide-react, `h-4 w-4`

**Buttons**:
- **Primary**: Default button variant with `rounded-2xl`
- **Secondary**: `variant="outline"` with `rounded-2xl`

### B. Pillars Section (Lines 120-197)

**Layout**: Two-column grid (`grid md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]`)

**Left Column** (Pillar Cards):
- **Padding**: `p-6 md:p-10` (24px/40px)
- **Border**: `border-b md:border-b-0 md:border-r border-stone-200 dark:border-[#3e3e42]`
- **Spacing**: `space-y-8` (32px between cards)

**Pillar Card Structure**:
- **Icon Container**: `rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/30 p-2`
- **Icon**: `BookOpenCheck`, `h-5 w-5`, `text-emerald-700 dark:text-emerald-300`
- **Eyebrow Text**: `text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400`
- **Title**: `CardTitle` component, `text-xl`
- **Description**: Either `CardDescription` or numbered list items

**Numbered List Items** (if description is array):
- **Circle**: `h-8 w-8 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200`
- **Number**: `text-xs font-semibold`, zero-padded (`padStart(2, "0")`)
- **Text**: `text-sm text-stone-700 dark:text-stone-200`

**Right Column** (Name Origin):
- **Background**: `bg-emerald-50/40 dark:bg-[#0f1a14]`
- **Padding**: `p-6 md:p-10`
- **Icon Container**: `rounded-2xl bg-white/80 dark:bg-white/10 p-2 shadow-sm`
- **Icon**: `Leaf`, `h-5 w-5`
- **Badges**: `rounded-full bg-white/80 dark:bg-white/5`, with `CalendarDays` icon

### C. Services & Practical Cards (Lines 200-247)

**Grid Layout**: `grid gap-4 md:grid-cols-2` (2 columns on desktop, 1 on mobile)

**Card Styling**:
- **Border Radius**: `rounded-[28px]`
- **Border**: `border border-stone-200 dark:border-[#3e3e42]`
- **Content Padding**: `p-6 md:p-8`

**Section Headers**:
- **Icon + Label**: `flex items-center gap-2 text-emerald-600 dark:text-emerald-400`
- **Label**: `text-xs uppercase tracking-wide`
- **Icon**: `h-4 w-4` (PartyPopper, MapPin, HeartHandshake)

**List Items**:
- **Layout**: `flex items-start gap-3`
- **Icon**: `Leaf`, `h-4 w-4 mt-1 text-emerald-600 dark:text-emerald-400`
- **Text**: `text-sm text-stone-700 dark:text-stone-200`

**Divider**: `border-t border-stone-200 dark:border-[#3e3e42]/80 pt-6`

### D. Meet the Team Section (Lines 249-318)

**Grid Layout**: `grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-6 gap-x-2 max-w-[600px] mx-auto justify-items-center`

**Member Card**:
- **Border Radius**: `rounded-xl`
- **Border**: `border border-stone-200/70 dark:border-[#3e3e42]/70`
- **Width**: `w-fit`
- **Padding**: `p-3 pb-0` (image container)

**Image Container**:
- **Size**: `w-[260px] max-w-full`
- **Aspect Ratio**: `aspect-square`
- **Border Radius**: `rounded-xl`
- **Border**: `border border-stone-200 dark:border-[#3e3e42]`
- **Background**: `bg-stone-100 dark:bg-[#1f1f1f]/60`
- **Image**: `h-full w-full object-cover`

**Placeholder** (if no image):
- **Border**: `border-dashed border-stone-300 dark:border-[#3e3e42]`
- **Background**: `bg-stone-50 dark:bg-[#1f1f1f]/60`
- **Text**: `text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400`

**Tag Badge** (overlay on image):
- **Position**: `absolute inset-x-3 bottom-3`
- **Style**: `rounded-full px-3 py-0.5 text-[11px] bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100 shadow-sm`

**Card Header**:
- **Padding**: `px-4 pb-4 pt-3`
- **Alignment**: `text-center`
- **Title**: `text-base`
- **Description**: `text-xs`

### E. Final CTA Section (Lines 320-333)

**Container**:
- **Border Radius**: `rounded-[28px]`
- **Border**: `border border-stone-200 dark:border-[#3e3e42]`
- **Background**: `bg-white dark:bg-[#1f1f1f]`
- **Padding**: `px-8 py-10 md:px-12 md:py-12`

**Radial Gradient Overlay**:
```tsx
className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.12),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.18),_transparent_60%)]"
```
- Creates a subtle emerald glow from the top
- Light: 12% opacity, 55% radius
- Dark: 18% opacity, 60% radius

**Layout**: `flex flex-col md:flex-row md:items-center md:justify-between gap-6`

---

## 6. ANIMATION SYSTEM (Framer Motion)

### Library
- **Package**: `framer-motion` (v12.23.12)
- **Component**: `motion.div`, `motion.h1`, `motion.p`

### Animation Patterns

**Hero Section Container**:
```tsx
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, ease: "easeOut" }}
```

**Title**:
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.1, duration: 0.6 }}
```

**Subtitle**:
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.2, duration: 0.6 }}
```

**CTA Buttons**:
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.3, duration: 0.6 }}
```

**Animation Characteristics**:
- **Type**: Fade + Slide Up
- **Duration**: 0.6 seconds
- **Easing**: `easeOut`
- **Stagger**: 0.1s delay increments
- **Initial State**: `opacity: 0, y: 20-30px`
- **Final State**: `opacity: 1, y: 0`

---

## 7. ICONS (Lucide React)

**Icon Library**: `lucide-react` (v0.542.0)

**Icons Used**:
- `Sparkles` - Hero badge, primary CTA
- `BookOpenCheck` - Pillar cards
- `Leaf` - Name origin, services list, numbered items
- `PartyPopper` - Services section
- `MapPin` - Practical info section
- `HeartHandshake` - Collaboration section
- `CalendarDays` - Name origin badges

**Icon Sizing**:
- **Small**: `h-4 w-4` (16px) - badges, list items
- **Medium**: `h-5 w-5` (20px) - card headers, sections
- **Custom**: `h-3 w-3` (12px) - small badges

**Icon Colors**:
- **Accent**: `text-emerald-600 dark:text-emerald-400`
- **Muted**: Inherit from parent text color

---

## 8. RESPONSIVE DESIGN

### Breakpoints (Tailwind Default)
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px

### Responsive Patterns

**Padding**:
- Mobile: `p-6`, `p-8`
- Desktop: `md:p-10`, `md:p-16`

**Text Sizes**:
- Mobile: `text-3xl`, `text-base`
- Desktop: `md:text-4xl`, `md:text-lg`

**Grid Layouts**:
- Mobile: Single column (`grid-cols-1`)
- Desktop: `md:grid-cols-2` or `md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]`

**Flex Direction**:
- Mobile: `flex-col`
- Desktop: `md:flex-row`

**Spacing**:
- Mobile: `gap-3`, `gap-4`
- Desktop: `md:gap-6`

---

## 9. SHADOWS & DEPTH

**Card Shadows**:
- Default: `shadow` (subtle shadow from Card component)
- Badge Overlay: `shadow-sm` (small shadow)

**No Heavy Shadows**: The design uses borders and gradients instead of heavy shadows for depth.

---

## 10. GLASSMORPHISM EFFECTS

**Backdrop Blur**:
- Hero Badge: `backdrop-blur` with `bg-white/70 dark:bg-[#2d2d30]/70`
- Creates a frosted glass effect

**Semi-Transparent Backgrounds**:
- Multiple elements use opacity values: `/70`, `/80`, `/90`, `/40`, `/60`
- Combined with backdrop-blur for glass effect

---

## 11. DARK MODE IMPLEMENTATION

**Toggle Class**: `dark` class on root element

**Color Strategy**:
- All colors have dark mode variants using `dark:` prefix
- Background colors switch from light neutrals to dark grays
- Text colors invert (dark text → light text)
- Borders use darker values in dark mode
- Emerald accents remain consistent but adjusted for contrast

**Key Dark Mode Colors**:
- Backgrounds: `#1e1e1e`, `#1f1f1f`, `#171717`, `#252526`, `#2d2d30`
- Borders: `#3e3e42`
- Text: `stone-200`, `stone-300`, `stone-400`

---

## 12. COMPONENT LIBRARY (shadcn/ui)

**Components Used**:
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Button` (with variants: `default`, `outline`, `secondary`)
- `Badge` (with variants: `default`, `secondary`)

**Component Styling**:
- All components accept `className` prop for customization
- Base styles from shadcn/ui, heavily customized with Tailwind classes
- Uses `cn()` utility for class merging

---

## 13. SPACING SYSTEM

**Vertical Spacing**:
- Section gaps: `space-y-12` (48px)
- Card internal: `space-y-6`, `space-y-8` (24px, 32px)
- List items: `space-y-3`, `space-y-4` (12px, 16px)

**Horizontal Spacing**:
- Gaps: `gap-2`, `gap-3`, `gap-4`, `gap-6` (8px, 12px, 16px, 24px)
- Padding: `px-4`, `px-8`, `px-12` (16px, 32px, 48px)

**Consistent Spacing Scale**: Uses Tailwind's default spacing scale (4px base unit)

---

## 14. ACCESSIBILITY FEATURES

**ARIA Labels**:
- Decorative blur orbs: `aria-hidden="true"`

**Semantic HTML**:
- Proper heading hierarchy (h1, h2, h3)
- Section elements for content organization
- Alt text for images

**Focus States**:
- Buttons have focus-visible styles (from Button component)

---

## 15. KEY DESIGN PATTERNS

### Pattern 1: Gradient Backgrounds
- Hero: Diagonal gradient (`bg-gradient-to-br`)
- CTA: Radial gradient overlay
- Always includes dark mode variants

### Pattern 2: Blur Effects
- Decorative blur orbs for depth
- Backdrop blur for glassmorphism
- `blur-3xl` for large decorative elements

### Pattern 3: Card-Based Layout
- All content sections use Card components
- Consistent border radius (28px-32px)
- Subtle borders for definition

### Pattern 4: Icon + Text Combinations
- Icons always paired with labels
- Consistent sizing and spacing
- Emerald accent color for icons

### Pattern 5: Numbered Lists
- Circular numbered badges
- Zero-padded numbers (01, 02, etc.)
- Emerald background with dark text

### Pattern 6: Badge System
- Multiple badge styles: rounded-2xl, rounded-full
- Used for tags, status, categories
- Semi-transparent backgrounds

---

## 16. IMPLEMENTATION CHECKLIST

To replicate this page perfectly, ensure:

- [ ] Tailwind CSS configured with custom colors
- [ ] Dark mode class-based system (`dark:` prefix)
- [ ] Framer Motion installed and configured
- [ ] Lucide React icons library
- [ ] shadcn/ui components (Card, Button, Badge)
- [ ] Custom font "Lavonte" loaded (optional)
- [ ] CSS variables for theming (from index.css)
- [ ] Responsive breakpoints (sm, md, lg)
- [ ] All border radius values match (32px, 28px, 16px, 12px)
- [ ] Gradient backgrounds with dark mode variants
- [ ] Blur effects (`backdrop-blur`, `blur-3xl`)
- [ ] Animation timing (0.6s duration, 0.1s stagger)
- [ ] Spacing system (4px base unit)
- [ ] Emerald color palette (50-900 scale)
- [ ] Stone color palette (50-900 scale)
- [ ] Proper i18n setup (react-i18next)

---

## 17. TECHNICAL STACK SUMMARY

- **Framework**: React 19.1.1
- **Styling**: Tailwind CSS 3.4.17
- **Animation**: Framer Motion 12.23.12
- **Icons**: Lucide React 0.542.0
- **Components**: shadcn/ui (Card, Button, Badge)
- **Routing**: React Router DOM 7.8.2
- **i18n**: react-i18next 16.2.4
- **Build Tool**: Vite 7.1.2
- **TypeScript**: 5.8.3

---

## 18. CRITICAL STYLING DETAILS

1. **Border Colors**: Always use `border-stone-200 dark:border-[#3e3e42]` for consistency
2. **Emerald Opacity**: Use `/40`, `/60`, `/70`, `/80`, `/90` for layered transparency
3. **Text Hierarchy**: Maintain consistent text size relationships
4. **Spacing Rhythm**: Use multiples of 4px (Tailwind scale)
5. **Border Radius**: Large radii (28px-32px) for modern feel
6. **Animation**: Always fade + slide up, never slide down
7. **Icon Sizing**: Match icon size to text size context
8. **Dark Mode**: Every color must have a dark variant
9. **Gradients**: Always provide both light and dark versions
10. **Blur Effects**: Use `blur-3xl` for decorative, `backdrop-blur` for glass

---

This guide provides everything needed to replicate the About Page's style and components perfectly. Follow the patterns, spacing, colors, and animations described above for pixel-perfect replication.
