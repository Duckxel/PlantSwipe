import React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/context/AuthContext"
import { Settings, Mail, Lock, Trash2, AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react"

export default function SettingsPage() {
  const { user, profile, refreshProfile, deleteAccount, signOut } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isPrivate, setIsPrivate] = React.useState(false)
  const [emailExpanded, setEmailExpanded] = React.useState(false)
  const [passwordExpanded, setPasswordExpanded] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  // Load current user data
  React.useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        navigate("/")
        return
      }

      try {
        // Get current email
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser?.email) {
          setEmail(authUser.email)
        }

        // Load profile privacy setting
        if (profile) {
          setIsPrivate(Boolean((profile as any).is_private || false))
        } else {
          // Fetch profile if not loaded
          const { data } = await supabase
            .from('profiles')
            .select('is_private')
            .eq('id', user.id)
            .maybeSingle()
          if (data) {
            setIsPrivate(Boolean(data.is_private || false))
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user?.id, profile, navigate])

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === email) {
      setError("Please enter a new email address")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError("Please enter a valid email address")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (updateError) throw updateError

      setSuccess("Email update request sent! Please check your new email for a confirmation link.")
      setNewEmail("")
      // Refresh auth state
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.email) {
        setEmail(authUser.email)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update email')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setError("Please enter your current password")
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
      })

      if (signInError) {
        throw new Error("Current password is incorrect")
      }

      // If sign in succeeds, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      setSuccess("Password updated successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) {
      setError(e?.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePrivacy = async () => {
    if (!user?.id) return

    const newPrivacyValue = !isPrivate
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_private: newPrivacyValue })
        .eq('id', user.id)

      if (updateError) throw updateError

      setIsPrivate(newPrivacyValue)
      setSuccess(`Profile is now ${newPrivacyValue ? 'private' : 'public'}`)
      await refreshProfile()
    } catch (e: any) {
      setError(e?.message || 'Failed to update privacy setting')
      setIsPrivate(!newPrivacyValue) // Revert on error
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm || deleteConfirmText !== "DELETE") {
      setError("Please type DELETE to confirm account deletion")
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const result = await deleteAccount()
      if (result?.error) {
        throw new Error(result.error)
      }

      // Sign out and redirect
      await signOut()
      navigate("/")
    } catch (e: any) {
      setError(e?.message || 'Failed to delete account')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
        <div className="p-8 text-center text-sm opacity-60">Loading settings…</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Settings className="h-6 w-6" />
          Account Settings
        </h1>
        <p className="text-sm opacity-70 mt-2">Manage your account preferences and security</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-start gap-2">
          <Check className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">{success}</div>
        </div>
      )}

      {/* Account Information */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <button
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <CardTitle>Email Address</CardTitle>
            </div>
            {emailExpanded ? (
              <ChevronUp className="h-5 w-5 opacity-60" />
            ) : (
              <ChevronDown className="h-5 w-5 opacity-60" />
            )}
          </button>
          {!emailExpanded ? (
            <CardDescription className="mt-2">
              Email Address: <span className="font-medium">{email}</span>
            </CardDescription>
          ) : (
            <CardDescription className="mt-2">
              Change your email address. You'll need to confirm the new email.
            </CardDescription>
          )}
        </CardHeader>
        {emailExpanded && (
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                type="email"
                value={email}
                disabled
                className="bg-stone-50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="newemail@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button
              onClick={handleUpdateEmail}
              disabled={saving || !newEmail || newEmail === email}
              className="rounded-2xl"
            >
              {saving ? "Updating..." : "Update Email"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Password */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <button
            onClick={() => setPasswordExpanded(!passwordExpanded)}
            className="w-full text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Password</CardTitle>
            </div>
            {passwordExpanded ? (
              <ChevronUp className="h-5 w-5 opacity-60" />
            ) : (
              <ChevronDown className="h-5 w-5 opacity-60" />
            )}
          </button>
          {!passwordExpanded ? (
            <CardDescription className="mt-2">
              Password: <span className="font-medium">••••••••</span>
            </CardDescription>
          ) : (
            <CardDescription className="mt-2">
              Change your password to keep your account secure.
            </CardDescription>
          )}
        </CardHeader>
        {passwordExpanded && (
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="rounded-2xl"
            >
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Privacy Settings */}
      <Card className="rounded-3xl mb-4">
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>Control who can see your profile and activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="private-profile"
              checked={isPrivate}
              onChange={handleTogglePrivacy}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <Label htmlFor="private-profile" className="font-medium cursor-pointer">
                Private Profile
              </Label>
              <p className="text-sm opacity-70 mt-1">
                When enabled, only your friends can see your profile and activity. Your profile will be hidden from public searches.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="rounded-3xl border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-600/80">
            Irreversible and destructive actions. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!deleteConfirm ? (
            <>
              <p className="text-sm opacity-90">
                Once you delete your account, there is no going back. This will permanently delete your account, profile, gardens, and all associated data.
              </p>
              <Button
                onClick={() => setDeleteConfirm(true)}
                variant="destructive"
                className="rounded-2xl"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-white border border-red-200 space-y-4">
                <p className="text-sm font-medium text-red-700">
                  Are you absolutely sure? This action cannot be undone.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-delete" className="text-sm">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    id="confirm-delete"
                    type="text"
                    placeholder="DELETE"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={deleting}
                    className="font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    variant="destructive"
                    disabled={deleting || deleteConfirmText !== "DELETE"}
                    className="rounded-2xl"
                  >
                    {deleting ? "Deleting..." : "Yes, Delete My Account"}
                  </Button>
                  <Button
                    onClick={() => {
                      setDeleteConfirm(false)
                      setDeleteConfirmText("")
                      setError(null)
                    }}
                    variant="secondary"
                    disabled={deleting}
                    className="rounded-2xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
