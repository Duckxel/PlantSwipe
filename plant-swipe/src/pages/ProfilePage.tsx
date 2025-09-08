import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth()
  const [displayName, setDisplayName] = React.useState(profile?.display_name || "")
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url || "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  React.useEffect(() => {
    setDisplayName(profile?.display_name || "")
    setAvatarUrl(profile?.avatar_url || "")
  }, [profile?.display_name, profile?.avatar_url])

  const save = async () => {
    setError(null)
    setOk(null)
    if (!user?.id) return
    setSaving(true)
    try {
      // Ensure unique display name (case-insensitive), excluding current user
      const check = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', displayName)
        .neq('id', user.id)
        .maybeSingle()
      if (check.data?.id) {
        setError('Display name already taken')
        return
      }
      const { error: uerr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: displayName, avatar_url: avatarUrl }, { onConflict: 'id' })
      if (uerr) {
        setError(uerr.message)
        return
      }
      await refreshProfile()
      setOk('Profile saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-4">
          {/* Removed User ID from UI */}
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={(user as any)?.email || ''} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Avatar URL</Label>
            <Input value={avatarUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAvatarUrl(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {ok && <div className="text-sm text-green-600">{ok}</div>}
          <div className="flex gap-2">
            <Button className="rounded-2xl" onClick={save} disabled={saving}>Save</Button>
            <Button className="rounded-2xl" variant="secondary" onClick={signOut}>Logout</Button>
            <Button className="rounded-2xl" variant="destructive" onClick={async () => { await deleteAccount() }}>Delete account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


