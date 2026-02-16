import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ValidatedInput } from "@/components/ui/validated-input"
import { useFieldValidation } from "@/hooks/useFieldValidation"
import { validateUsername } from "@/lib/username"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { CityCountrySelector, type SelectedLocation } from "@/components/ui/city-country-selector"
import { ACCENT_OPTIONS, applyAccentByKey, saveAccentKey } from "@/lib/accent"
import type { AccentKey } from "@/lib/accent"
import { useTranslation } from "react-i18next"
import { User, MapPin, Briefcase, FileText, ExternalLink, Palette, Loader2, Check, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"

export type EditProfileValues = {
  display_name: string
  city: string
  country: string
  bio: string
  job: string
  profile_link: string
  show_country: boolean
  accent_key: AccentKey | null
}

export const EditProfileDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: EditProfileValues
  onSubmit: (values: EditProfileValues) => Promise<void>
  submitting?: boolean
  error?: string | null
}> = ({ open, onOpenChange, initial, onSubmit, submitting, error }) => {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [values, setValues] = React.useState<EditProfileValues>(initial)

  React.useEffect(() => { setValues(initial) }, [initial])

  const set = (k: keyof EditProfileValues, v: string | boolean) => setValues((prev) => ({ ...prev, [k]: v }))

  // Debounced username validation (format + uniqueness check)
  const usernameValidation = useFieldValidation(
    values.display_name,
    React.useCallback(async (val: string) => {
      const fmt = validateUsername(val)
      if (!fmt.valid) return { valid: false, error: fmt.error }

      if (fmt.normalized === initial.display_name.trim().toLowerCase()) {
        return { valid: true }
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('display_name', fmt.normalized!)
          .neq('id', user?.id ?? '')
          .maybeSingle()
        if (data?.id) {
          return { valid: false, error: t('profile.editProfile.displayNameTaken', { defaultValue: 'This username is already taken.' }) }
        }
      } catch {
        // Network error -- don't block
      }

      return { valid: true }
    }, [initial.display_name, user?.id, t]),
    400,
  )

  const chooseAccent = (key: AccentKey) => {
    set('accent_key', key)
    applyAccentByKey(key)
  }

  const submit = async () => {
    if (submitting) return
    await onSubmit(values)
    if (values.accent_key) saveAccentKey(values.accent_key)
  }

  const hasChanges = React.useMemo(() => {
    return (
      values.display_name !== initial.display_name ||
      values.city !== initial.city ||
      values.country !== initial.country ||
      values.bio !== initial.bio ||
      values.job !== initial.job ||
      values.profile_link !== initial.profile_link ||
      values.show_country !== initial.show_country ||
      values.accent_key !== initial.accent_key
    )
  }, [values, initial])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:rounded-2xl max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
          <DialogTitle className="text-lg font-bold">
            {t('profile.editProfile.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t('profile.editProfile.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable form content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-5">

          {/* --- Identity Section --- */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              <User className="h-4 w-4 text-accent" />
              {t('profile.editProfile.identitySection', { defaultValue: 'Identity' })}
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#1c1c1f]/50 p-3 space-y-3">
              {/* Username */}
              <div className="grid gap-1.5">
                <Label htmlFor="ep-name" className="text-xs font-medium opacity-70">
                  {t('profile.editProfile.displayName')}
                </Label>
                <ValidatedInput
                  id="ep-name"
                  value={values.display_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('display_name', e.target.value)}
                  status={usernameValidation.status}
                  error={usernameValidation.error}
                  placeholder={t('profile.editProfile.displayNamePlaceholder', { defaultValue: 'Enter your username' })}
                />
              </div>

              {/* Job */}
              <div className="grid gap-1.5">
                <Label htmlFor="ep-job" className="text-xs font-medium opacity-70 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {t('profile.editProfile.job', { defaultValue: 'Job title' })}
                </Label>
                <Input
                  id="ep-job"
                  value={values.job}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('job', e.target.value)}
                  placeholder={t('profile.editProfile.jobPlaceholder', { defaultValue: 'e.g. Landscape designer, Botanist...' })}
                  maxLength={100}
                />
              </div>
            </div>
          </section>

          {/* --- Location Section --- */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              <MapPin className="h-4 w-4 text-accent" />
              {t('profile.editProfile.locationSection', { defaultValue: 'Location' })}
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#1c1c1f]/50 p-3 space-y-3">
              <CityCountrySelector
                city={values.city}
                country={values.country}
                onSelect={(location: SelectedLocation) => {
                  setValues(prev => ({
                    ...prev,
                    city: location.city,
                    country: location.country,
                  }))
                }}
                onClear={() => {
                  setValues(prev => ({
                    ...prev,
                    city: '',
                    country: '',
                  }))
                }}
                disabled={submitting}
                showDetectButton
                variant="sm"
                label=""
              />
              {/* Show on profile toggle */}
              <div className="flex items-center justify-between rounded-lg bg-white dark:bg-[#2d2d30] border border-stone-200/50 dark:border-[#3e3e42]/50 px-3 py-2">
                <Label htmlFor="ep-show-country" className="text-xs cursor-pointer flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                  {values.show_country
                    ? <Eye className="h-3.5 w-3.5" />
                    : <EyeOff className="h-3.5 w-3.5" />
                  }
                  {t('profile.editProfile.showCountryOnProfile', { defaultValue: 'Show on profile' })}
                </Label>
                <Switch
                  id="ep-show-country"
                  checked={values.show_country}
                  onCheckedChange={(checked) => set('show_country', checked)}
                />
              </div>
            </div>
          </section>

          {/* --- About Section --- */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              <FileText className="h-4 w-4 text-accent" />
              {t('profile.editProfile.aboutSection', { defaultValue: 'About you' })}
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#1c1c1f]/50 p-3 space-y-3">
              {/* Bio */}
              <div className="grid gap-1.5">
                <Label htmlFor="ep-bio" className="text-xs font-medium opacity-70">
                  {t('profile.editProfile.bio')}
                </Label>
                <Textarea
                  id="ep-bio"
                  value={values.bio}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('bio', e.target.value)}
                  placeholder={t('profile.editProfile.bioPlaceholder', { defaultValue: 'Tell others about yourself and your garden...' })}
                  rows={3}
                  maxLength={300}
                  className="resize-none text-sm"
                />
                <p className="text-right text-[10px] opacity-40 tabular-nums">
                  {values.bio.length}/300
                </p>
              </div>

              {/* External link */}
              <div className="grid gap-1.5">
                <Label htmlFor="ep-link" className="text-xs font-medium opacity-70 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {t('profile.editProfile.profileLink', { defaultValue: 'External link' })}
                </Label>
                <Input
                  id="ep-link"
                  type="url"
                  value={values.profile_link}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('profile_link', e.target.value)}
                  placeholder={t('profile.editProfile.profileLinkPlaceholder', { defaultValue: 'https://...' })}
                />
              </div>
            </div>
          </section>

          {/* --- Accent Color Section --- */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
              <Palette className="h-4 w-4 text-accent" />
              {t('profile.editProfile.accentColor')}
            </div>
            <div className="grid grid-cols-8 gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const active = values.accent_key === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseAccent(opt.key)}
                    className="relative aspect-square rounded-full transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    title={opt.label}
                    style={{ backgroundColor: opt.hex }}
                    aria-pressed={active}
                  >
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white drop-shadow-sm" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-[-3px] rounded-full border-2 border-stone-500 dark:border-stone-400" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 sm:px-6 sm:py-4 border-t border-stone-200 dark:border-[#3e3e42] bg-stone-50/50 dark:bg-[#1c1c1f]/30">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || usernameValidation.status === 'error' || !hasChanges}
            className="rounded-xl gap-2 min-w-[100px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.saving', { defaultValue: 'Saving...' })}
              </>
            ) : (
              t('common.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
