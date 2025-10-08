import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ACCENT_OPTIONS, applyAccentByKey, saveAccentKey } from "@/lib/accent"
import type { AccentKey } from "@/lib/accent"

export type EditProfileValues = {
  display_name: string
  country: string
  bio: string
  timezone: string
  experience_years: string
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
  const [values, setValues] = React.useState<EditProfileValues>(initial)

  React.useEffect(() => { setValues(initial) }, [initial])

  const set = (k: keyof EditProfileValues, v: string) => setValues((prev) => ({ ...prev, [k]: v }))

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
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your info and choose an accent color.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="ep-name">Display name</Label>
            <Input id="ep-name" value={values.display_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('display_name', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-country">Country</Label>
            <Input id="ep-country" value={values.country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('country', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-timezone">Timezone</Label>
            <Input id="ep-timezone" value={values.timezone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('timezone', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-exp">Years of experience with plants</Label>
            <Input id="ep-exp" type="number" inputMode="numeric" value={values.experience_years} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('experience_years', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-bio">Bio</Label>
            <textarea id="ep-bio" value={values.bio} onChange={(e) => set('bio', (e.target as HTMLTextAreaElement).value)} className="min-h-[80px] px-3 py-2 rounded-xl border" />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Accent color</div>
            <div className="grid grid-cols-5 gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const active = values.accent_key === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => chooseAccent(opt.key)}
                    className={`h-10 rounded-xl border relative ${active ? 'ring-2 ring-offset-2' : ''}`}
                    title={opt.label}
                    style={{ backgroundColor: `hsl(${opt.hsl})`, boxShadow: active ? `0 0 0 2px hsl(${opt.hsl}) inset` : undefined }}
                    aria-pressed={active}
                  >
                  </button>
                )
              })}
            </div>
            <div className="text-xs opacity-60">Preview applies instantly; saved on Save.</div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

