import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ACCENT_OPTIONS, applyAccentByKey, saveAccentKey } from "@/lib/accent"
import type { AccentKey } from "@/lib/accent"
import { useTranslation } from "react-i18next"
import { MapPin, ExternalLink, ArrowRight } from "lucide-react"
import { useLanguageNavigate } from "@/lib/i18nRouting"

export type EditProfileValues = {
  display_name: string
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
  const navigate = useLanguageNavigate()
  const [values, setValues] = React.useState<EditProfileValues>(initial)

  React.useEffect(() => { setValues(initial) }, [initial])

  const set = (k: keyof EditProfileValues, v: string | boolean) => setValues((prev) => ({ ...prev, [k]: v }))

  const chooseAccent = (key: AccentKey) => {
    set('accent_key', key)
    // Preview immediately
    applyAccentByKey(key)
  }

  const submit = async () => {
    if (submitting) return
    await onSubmit(values)
    if (values.accent_key) saveAccentKey(values.accent_key)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('profile.editProfile.title')}</DialogTitle>
          <DialogDescription>{t('profile.editProfile.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="ep-name">{t('profile.editProfile.displayName')}</Label>
            <Input id="ep-name" value={values.display_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('display_name', e.target.value)} />
          </div>

          {/* Country - read-only with show/hide toggle and link to settings */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 opacity-60" />
              {t('profile.editProfile.country')}
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl border border-stone-200 dark:border-[#3e3e42] bg-stone-50 dark:bg-[#2d2d30] px-3 py-2 text-sm text-stone-500 dark:text-stone-400">
                {values.country || t('profile.editProfile.noCountrySet', { defaultValue: 'Not set' })}
              </div>
              <button
                type="button"
                onClick={() => { onOpenChange(false); navigate('/settings') }}
                className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-[#3e3e42] px-3 py-2 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#2d2d30] transition-colors"
                title={t('profile.editProfile.changeInSettings', { defaultValue: 'Change in settings' })}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                {t('profile.editProfile.changeInSettings', { defaultValue: 'Change in settings' })}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <Label htmlFor="ep-show-country" className="text-xs opacity-70 cursor-pointer">
                {t('profile.editProfile.showCountryOnProfile', { defaultValue: 'Show country on profile' })}
              </Label>
              <Switch
                id="ep-show-country"
                checked={values.show_country}
                onCheckedChange={(checked) => set('show_country', checked)}
              />
            </div>
          </div>

          {/* Job */}
          <div className="grid gap-2">
            <Label htmlFor="ep-job">{t('profile.editProfile.job', { defaultValue: 'Job' })}</Label>
            <Input
              id="ep-job"
              value={values.job}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('job', e.target.value)}
              placeholder={t('profile.editProfile.jobPlaceholder', { defaultValue: 'e.g. Landscape designer, Botanist...' })}
              maxLength={100}
            />
          </div>

          {/* Bio */}
          <div className="grid gap-2">
            <Label htmlFor="ep-bio">{t('profile.editProfile.bio')}</Label>
            <Textarea id="ep-bio" value={values.bio} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('bio', e.target.value)} />
          </div>

          {/* External link */}
          <div className="grid gap-2">
            <Label htmlFor="ep-link" className="flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              {t('profile.editProfile.profileLink', { defaultValue: 'External link' })}
            </Label>
            <Input
              id="ep-link"
              type="url"
              value={values.profile_link}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('profile_link', e.target.value)}
              placeholder={t('profile.editProfile.profileLinkPlaceholder', { defaultValue: 'https://...' })}
            />
            <p className="text-[11px] opacity-50">{t('profile.editProfile.profileLinkHint', { defaultValue: 'Visitors will be redirected to this link in a new tab.' })}</p>
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">{t('profile.editProfile.accentColor')}</div>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const active = values.accent_key === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseAccent(opt.key)}
                    className={`h-10 rounded-xl border-0 relative ${active ? 'ring-2 ring-offset-2 ring-stone-500 dark:ring-stone-400' : ''}`}
                    title={opt.label}
                    style={{ backgroundColor: opt.hex }}
                    aria-pressed={active}
                  >
                  </button>
                )
              })}
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={submitting}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
