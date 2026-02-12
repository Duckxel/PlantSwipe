# Reusable Components Reference

> **For AI Agents and Human Developers**
> Read this document before creating new UI elements. Prefer reusing existing components.

---

## Table of Contents

1. [Overview](#overview)
2. [Form Inputs](#form-inputs)
3. [Validation Hooks](#validation-hooks)
4. [Validation Utilities](#validation-utilities)
5. [Layout Components](#layout-components)
6. [Usage Patterns](#usage-patterns)

---

## Overview

This document catalogues all reusable components, hooks, and utilities in the Aphylia codebase. Before building new UI, check here first to avoid duplication and maintain consistency.

**Rule:** If you add, modify, or remove a reusable component, hook, or utility — **update this file**.

---

## Form Inputs

### `ValidatedInput`

**File:** `src/components/ui/validated-input.tsx`

An input field with built-in validation feedback. Shows a loading spinner while validating, a green checkmark when valid, and a red error icon plus message when invalid. Supports password visibility toggle and email typo suggestions.

**Props (extends HTML `<input>`):**

| Prop | Type | Description |
|------|------|-------------|
| `status` | `'idle' \| 'validating' \| 'valid' \| 'error'` | Drives the icon and ring color |
| `error` | `string \| null` | Error message displayed below the input |
| `suggestion` | `string \| null` | Suggestion text (e.g., typo correction) |
| `onAcceptSuggestion` | `() => void` | Callback when user clicks suggestion |
| `type` | `string` | Supports `"password"` with auto toggle |
| `wrapperClassName` | `string` | Class for the outer wrapper |

**Example:**

```tsx
import { ValidatedInput } from "@/components/ui/validated-input"
import { useFieldValidation } from "@/hooks/useFieldValidation"

const { status, error } = useFieldValidation(email, validateFn)
<ValidatedInput
  type="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  status={status}
  error={error}
  placeholder="you@example.com"
/>
```

**Used in:** Signup dialog (PlantSwipe.tsx), Settings page (email change, password change)

---

### `PasswordRules`

**File:** `src/components/ui/password-rules.tsx`

A compact checklist that shows which password strength rules are met. Each rule displays a green check or red cross.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `rules` | `PasswordRule[]` | Array from `validatePassword()` |
| `visible` | `boolean` | Controls visibility (hide when field is empty) |
| `className` | `string` | Optional wrapper class |

**Example:**

```tsx
import { PasswordRules } from "@/components/ui/password-rules"
import { validatePassword } from "@/lib/passwordValidation"

const result = validatePassword(password)
<PasswordRules rules={result.rules} visible={password.length > 0} />
```

**Used in:** Signup dialog (PlantSwipe.tsx), Settings page (password change)

---

### `SearchInput`

**File:** `src/components/ui/search-input.tsx`

A search-specific input with a search icon, loading spinner, clear button, and keyboard shortcut hint. Consistent styling across all search fields.

**Props (extends HTML `<input>`):**

| Prop | Type | Description |
|------|------|-------------|
| `loading` | `boolean` | Show loading spinner |
| `icon` | `ReactNode \| null` | Custom icon or null to hide |
| `variant` | `'sm' \| 'default' \| 'lg'` | Size variant |
| `onClear` | `() => void` | Clear button callback |
| `shortcut` | `string` | Keyboard shortcut hint |

**Used in:** Discovery page search, garden search, messaging search, setup location search

---

### `Input`

**File:** `src/components/ui/input.tsx`

Basic styled input. Use `ValidatedInput` instead when you need validation feedback.

---

## Validation Hooks

### `useFieldValidation`

**File:** `src/hooks/useFieldValidation.ts`

Performs debounced async validation on a field value. After the user stops typing for the specified delay, the validate function runs. Returns a status, error message, and optional suggestion.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `value` | `string` | — | Current field value |
| `validate` | `(value: string) => Promise<{valid, error?, suggestion?}>` | — | Async validation function |
| `delay` | `number` | `400` | Debounce delay in ms |
| `enabled` | `boolean` | `true` | Set to false to pause validation |

**Returns:** `{ status, error, suggestion, reset }`

**Example:**

```tsx
const validation = useFieldValidation(
  email,
  async (val) => {
    const result = validateEmailFormat(val)
    if (!result.valid) return { valid: false, error: result.error }
    return { valid: true }
  },
  400,
)
// validation.status → 'idle' | 'validating' | 'valid' | 'error'
```

**Used in:** PlantSwipe.tsx (signup fields), SettingsPage.tsx (email/password change)

---

### `useDebounce`

**File:** `src/hooks/useDebounce.ts`

Simple value debounce hook. Returns the debounced value after the specified delay.

**Used in:** Search inputs, location search

---

## Validation Utilities

### Email Validation

**File:** `src/lib/emailValidation.ts`

Multi-layered email validation:
- `validateEmailFormat(email)` — Instant client-side format check (RFC 5322, disposable domain blocking, typo detection)
- `validateEmailDomain(email)` — Server-side DNS MX record check via `/api/email/validate`
- `validateEmail(email)` — Runs both format + domain checks sequentially

**Used in:** Signup (AuthContext.tsx), email change (SettingsPage.tsx), validation hooks

---

### Username Validation

**File:** `src/lib/username.ts`

- `validateUsername(username)` — Checks format (2-30 chars, URL-safe characters, no consecutive specials)
- `normalizeUsername(username)` — Lowercase for comparison
- `validateAndNormalizeUsername(username)` — Throws on invalid

**Used in:** Signup (AuthContext.tsx), validation hooks

---

### Password Validation

**File:** `src/lib/passwordValidation.ts`

- `validatePassword(password)` — Checks strength rules (8+ chars, letter, number, special character). Returns per-rule details for the `PasswordRules` component.

**Used in:** Signup (PlantSwipe.tsx), password change (SettingsPage.tsx), AuthContext.tsx

---

## Media Components

### `ImageViewer`

**File:** `src/components/ui/image-viewer.tsx`

A unified fullscreen image viewer/lightbox that supports single images and multi-image galleries. Features zoom & pan, keyboard navigation, touch swipe, optional download, smooth animations, and auto-hiding controls.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Whether the viewer is open |
| `onClose` | `() => void` | — | Callback when the viewer should close |
| `images` | `ImageViewerImage[]` | — | Array of `{ src, alt? }` objects |
| `initialIndex` | `number` | `0` | Index of the initially active image |
| `enableZoom` | `boolean` | `true` | Show zoom controls and enable zoom/pan |
| `enableDownload` | `boolean` | `false` | Show download button |
| `title` | `string` | — | Accessible title (sr-only) |
| `className` | `string` | — | Additional class on the root overlay |

**Companion Hook: `useImageViewer`**

Manages open/close state and selected image(s) for the `ImageViewer` component.

**Returns:** `{ isOpen, open, openGallery, close, props }`

| Method | Signature | Description |
|--------|-----------|-------------|
| `open` | `(src: string, alt?: string) => void` | Open viewer with a single image |
| `openGallery` | `(images: ImageViewerImage[], startIndex?: number) => void` | Open viewer with multiple images |
| `close` | `() => void` | Close the viewer |
| `props` | `object` | Spread onto `<ImageViewer>` (`open`, `onClose`, `images`, `initialIndex`) |

**Features:**
- Single image or multi-image gallery mode
- Zoom & pan (scroll wheel, drag, double-click, +/- keys)
- Keyboard navigation (Escape, Arrow keys)
- Touch swipe to navigate between images
- Auto-hiding controls with tap-to-toggle
- Dot indicators for gallery mode
- Portal-based rendering (appended to `document.body`)

**Example (single image):**

```tsx
import { useImageViewer, ImageViewer } from "@/components/ui/image-viewer"

const viewer = useImageViewer()

<img
  src={imageUrl}
  onClick={() => viewer.open(imageUrl, "My image")}
  className="cursor-zoom-in"
/>
<ImageViewer {...viewer.props} enableZoom />
```

**Example (gallery):**

```tsx
const viewer = useImageViewer()
const images = photos.map(p => ({ src: p.url, alt: p.name }))

<img onClick={() => viewer.openGallery(images, 0)} />
<ImageViewer {...viewer.props} enableZoom enableDownload />
```

**Used in:** BlogPostPage, ScanPage, PlantDetails, MessageBubble

---

## Layout Components

### `TopBar` / `BottomBar` / `MobileNavBar` / `Footer`

**Files:** `src/components/layout/`

Global layout components. Do not duplicate — extend if needed.

---

## Usage Patterns

### Adding a Validated Field

1. Import `ValidatedInput` and `useFieldValidation`
2. Create a validation function that returns `{ valid, error?, suggestion? }`
3. Wire up the hook and pass `status`/`error` to the component

```tsx
const validation = useFieldValidation(value, myValidateFn, 400)

<ValidatedInput
  value={value}
  onChange={e => setValue(e.target.value)}
  status={validation.status}
  error={validation.error}
/>
```

### Adding a Password Field

1. Import `ValidatedInput`, `PasswordRules`, and `validatePassword`
2. Compute rules with `useMemo` and create a validation hook
3. Render both components together

```tsx
const result = useMemo(() => validatePassword(pw), [pw])
const validation = useFieldValidation(pw, async v => {
  const r = validatePassword(v)
  return r.valid ? { valid: true } : { valid: false, error: r.error }
}, 400)

<ValidatedInput type="password" status={validation.status} error={validation.error} ... />
<PasswordRules rules={result.rules} visible={pw.length > 0} />
```

---

## Image Upload & Management

### Plant Image Upload Service

**File:** `src/lib/externalImages.ts`

Reusable functions for fetching, uploading, and deleting plant images stored in the **PLANTS** Supabase storage bucket.

#### `fetchExternalPlantImages(plantName, options?)`

Fetches free-to-use images from 3 external sources (Google/SerpAPI, GBIF, Smithsonian). Returns raw image URLs with per-source progress callbacks.

- **SerpAPI**: Top 5 Google Images with Creative Commons license (query: `"<name> plant"`)
- **GBIF**: CC0-licensed occurrence images (resolves common names to scientific via species/match + vernacular search)
- **Smithsonian**: Open Access collection images (uses scientific name for better results)
- Hard cap: **15 images** total across all sources
- Allowed formats: jpg, jpeg, png, webp only (tif, exr, etc. filtered server-side)

#### `uploadPlantImageFromUrl(imageUrl, plantName, source, signal?)`

Uploads an external image URL to the PLANTS storage bucket:
1. Server fetches the image from the URL
2. Optimizes with `sharp`: resize to max 1600px, convert to **WebP** at quality 80
3. Stores in Supabase `PLANTS` bucket under `plants/images/<plant-name>/<uuid>.webp`
4. Records in `admin_media_uploads` table with `upload_source: 'plant_image'`
5. Returns the media proxy URL (not raw Supabase URL)

#### `deletePlantImage(imageUrl, signal?)`

Deletes a plant image from both storage and `admin_media_uploads`:
- Only deletes images in the PLANTS bucket (external URLs are silently skipped)
- Removes the storage object and the DB tracking record

#### `isManagedPlantImageUrl(url)`

Returns `true` if the URL points to a managed plant image (contains `/PLANTS/`). Use to decide whether removal should also trigger storage deletion.

### Usage in PlantProfileForm

The `PlantProfileForm` component accepts an `onImageRemove?: (imageUrl: string) => void` prop. When a user removes an image from the `ImageEditor`, this callback is fired with the image URL. The parent component should check `isManagedPlantImageUrl()` and call `deletePlantImage()` if needed.

```tsx
<PlantProfileForm
  value={plant}
  onChange={setPlant}
  onImageRemove={(url) => {
    if (isManagedPlantImageUrl(url)) {
      deletePlantImage(url).catch(console.warn)
    }
  }}
/>
```

### Storage Configuration (Server)

| Setting | Value | Env Override |
|---|---|---|
| Bucket | `PLANTS` | `PLANT_IMAGE_BUCKET` |
| Prefix | `plants/images` | `PLANT_IMAGE_PREFIX` |
| Max dimension | 1600px | — |
| WebP quality | 80 | — |
| Max fetch size | 10 MB | — |
