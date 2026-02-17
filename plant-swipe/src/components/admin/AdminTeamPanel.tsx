import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
  type TeamMember,
  type TeamMemberInput,
} from "@/hooks/useTeamMembers"
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  RefreshCw,
  Users,
  ImageIcon,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item"

async function buildAdminHeaders() {
  const session = (await supabase.auth.getSession()).data.session
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  const globalEnv = globalThis as { __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: string } }
  const adminToken = globalEnv.__ENV__?.VITE_ADMIN_STATIC_TOKEN
  if (adminToken) headers["X-Admin-Token"] = adminToken
  return headers
}

type EditingMember = TeamMemberInput & { id?: string; _selectedUserName?: string }

const emptyMember: EditingMember = {
  name: "",
  display_name: "",
  role: "",
  tag: "",
  image_url: "",
  user_id: null,
  position: 999,
  is_active: true,
}

export const AdminTeamPanel: React.FC = () => {
  const { teamMembers, loading, error, refetch } = useTeamMembers(true) // Include inactive
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingMember, setEditingMember] = React.useState<EditingMember>(emptyMember)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleOpenCreate = () => {
    setEditingMember({ ...emptyMember, position: teamMembers.length })
    setSubmitError(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember({
      id: member.id,
      name: member.name,
      display_name: member.display_name,
      role: member.role,
      tag: member.tag || "",
      image_url: member.image_url || "",
      user_id: member.user_id || null,
      position: member.position,
      is_active: member.is_active,
    })
    setSubmitError(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingMember(emptyMember)
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (editingMember.id) {
        // Update existing
        await updateTeamMember(editingMember.id, {
          name: editingMember.name,
          display_name: editingMember.display_name,
          role: editingMember.role,
          tag: editingMember.tag || null,
          image_url: editingMember.image_url || null,
          user_id: editingMember.user_id || null,
          position: editingMember.position,
          is_active: editingMember.is_active,
        })
      } else {
        // Create new
        await createTeamMember({
          name: editingMember.name,
          display_name: editingMember.display_name,
          role: editingMember.role,
          tag: editingMember.tag || null,
          image_url: editingMember.image_url || null,
          user_id: editingMember.user_id || null,
          position: editingMember.position,
          is_active: editingMember.is_active,
        })
      }
      await refetch()
      handleCloseDialog()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save team member"
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmId) return
    setIsDeleting(true)
    try {
      await deleteTeamMember(deleteConfirmId)
      await refetch()
      setDeleteConfirmId(null)
    } catch (err) {
      console.error("Failed to delete team member:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMoveUp = async (member: TeamMember) => {
    const currentIndex = teamMembers.findIndex((m) => m.id === member.id)
    if (currentIndex <= 0) return

    const newOrder = [...teamMembers]
    const temp = newOrder[currentIndex - 1]
    newOrder[currentIndex - 1] = newOrder[currentIndex]
    newOrder[currentIndex] = temp

    try {
      await reorderTeamMembers(newOrder.map((m) => m.id))
      await refetch()
    } catch (err) {
      console.error("Failed to reorder:", err)
    }
  }

  const handleMoveDown = async (member: TeamMember) => {
    const currentIndex = teamMembers.findIndex((m) => m.id === member.id)
    if (currentIndex < 0 || currentIndex >= teamMembers.length - 1) return

    const newOrder = [...teamMembers]
    const temp = newOrder[currentIndex + 1]
    newOrder[currentIndex + 1] = newOrder[currentIndex]
    newOrder[currentIndex] = temp

    try {
      await reorderTeamMembers(newOrder.map((m) => m.id))
      await refetch()
    } catch (err) {
      console.error("Failed to reorder:", err)
    }
  }

  const handleToggleActive = async (member: TeamMember) => {
    try {
      await updateTeamMember(member.id, { is_active: !member.is_active })
      await refetch()
    } catch (err) {
      console.error("Failed to toggle active state:", err)
    }
  }

  // Search users via admin API for the SearchItem component
  const searchUsers = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    try {
      const headers = await buildAdminHeaders()
      const url = `/api/admin/search-users?q=${encodeURIComponent(query)}&limit=20`
      const resp = await fetch(url, { headers, credentials: "same-origin" })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return []
      const users = Array.isArray(data?.users) ? data.users : []
      return users.map((u: { id: string; display_name: string | null; avatar_url: string | null; roles: string[] }) => ({
        id: u.id,
        label: u.display_name || "Unnamed user",
        description: u.id,
        meta: u.roles.length > 0 ? u.roles.join(", ") : undefined,
        icon: u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
        ) : (
          <User className="h-4 w-4 text-stone-400" />
        ),
      }))
    } catch {
      return []
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Team Members</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Manage team members displayed on the About page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" className="rounded-xl" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="rounded-xl border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-1">
              Make sure the team_members table exists. Run the migration in supabase/migrations/add_team_members.sql
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )}

      {/* Team Members List */}
      {!loading && !error && (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Users className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
                <h4 className="text-lg font-medium text-stone-900 dark:text-white mb-2">
                  No team members yet
                </h4>
                <p className="text-sm text-stone-500 dark:text-stone-400 text-center mb-6">
                  Add your first team member to display on the About page
                </p>
                <Button onClick={handleOpenCreate} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Member
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-[#2a2a2d]">
                {teamMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-stone-50 dark:hover:bg-[#1a1a1d] transition-colors",
                      !member.is_active && "opacity-50"
                    )}
                  >
                    {/* Drag Handle / Position Controls */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(member)}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4 text-stone-500" />
                      </button>
                      <GripVertical className="h-4 w-4 text-stone-400" />
                      <button
                        type="button"
                        onClick={() => handleMoveDown(member)}
                        disabled={index === teamMembers.length - 1}
                        className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4 text-stone-500" />
                      </button>
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {member.image_url ? (
                        <div className="h-16 w-16 rounded-xl overflow-hidden border border-stone-200 dark:border-[#3e3e42]">
                          <img
                            src={member.image_url}
                            alt={member.display_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center border border-dashed border-stone-300 dark:border-[#3e3e42]">
                          <ImageIcon className="h-6 w-6 text-stone-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-stone-900 dark:text-white">
                          {member.display_name}
                        </h4>
                        {member.tag && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            {member.tag}
                          </span>
                        )}
                        {!member.is_active && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{member.role}</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                        ID: {member.name} • Position: {member.position}
                        {member.user_id && (
                          <span className="ml-1">
                            • Linked: <span className="font-mono text-emerald-600 dark:text-emerald-400">{member.user_id.slice(0, 8)}...</span>
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          member.is_active
                            ? "hover:bg-stone-100 dark:hover:bg-stone-800 text-emerald-600"
                            : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                        )}
                        title={member.is_active ? "Hide from About page" : "Show on About page"}
                      >
                        {member.is_active ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(member)}
                        className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(member.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Link */}
      {!loading && !error && teamMembers.length > 0 && (
        <div className="flex justify-end">
          <a
            href="/about"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View About Page
          </a>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingMember.id ? "Edit Team Member" : "Add Team Member"}
            </DialogTitle>
            <DialogDescription>
              {editingMember.id
                ? "Update team member information"
                : "Add a new team member to display on the About page"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">ID / Key</Label>
                <Input
                  id="name"
                  value={editingMember.name}
                  onChange={(e) =>
                    setEditingMember((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., john_doe"
                  required
                  className="rounded-xl"
                />
                <p className="text-xs text-stone-500">Unique identifier (lowercase, no spaces)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={editingMember.display_name}
                  onChange={(e) =>
                    setEditingMember((prev) => ({ ...prev, display_name: e.target.value }))
                  }
                  placeholder="e.g., John Doe"
                  required
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role / Title</Label>
                <Input
                  id="role"
                  value={editingMember.role}
                  onChange={(e) =>
                    setEditingMember((prev) => ({ ...prev, role: e.target.value }))
                  }
                  placeholder="e.g., Co-Founder"
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag">Tag / Nickname</Label>
                <Input
                  id="tag"
                  value={editingMember.tag || ""}
                  onChange={(e) =>
                    setEditingMember((prev) => ({ ...prev, tag: e.target.value }))
                  }
                  placeholder="e.g., Creative Lead"
                  className="rounded-xl"
                />
                <p className="text-xs text-stone-500">Optional badge shown on photo</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Linked User Profile</Label>
              <SearchItem
                value={editingMember.user_id || null}
                onSelect={(option) =>
                  setEditingMember((prev) => ({
                    ...prev,
                    user_id: option.id,
                    _selectedUserName: option.label,
                  }))
                }
                onClear={() =>
                  setEditingMember((prev) => ({
                    ...prev,
                    user_id: null,
                    _selectedUserName: undefined,
                  }))
                }
                onSearch={searchUsers}
                placeholder="Search and link a user..."
                title="Link User Profile"
                description="Search for a user to link to this team member. Their name will be clickable on the About page."
                searchPlaceholder="Search by name..."
                emptyMessage="No users found."
                selectedLabel={(opt) => opt.label}
                priorityZIndex={120}
              />
              <p className="text-xs text-stone-500">
                Optional — link to an existing user profile. Name becomes clickable on the About page.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                type="url"
                value={editingMember.image_url || ""}
                onChange={(e) =>
                  setEditingMember((prev) => ({ ...prev, image_url: e.target.value }))
                }
                placeholder="https://media.aphylia.app/..."
                className="rounded-xl"
              />
              <p className="text-xs text-stone-500">
                Upload images via Admin → Upload and Media, then paste the URL here
              </p>
            </div>

            {editingMember.image_url && (
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-xl overflow-hidden border border-stone-200 dark:border-[#3e3e42]">
                  <img
                    src={editingMember.image_url}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = ""
                      e.currentTarget.alt = "Failed to load"
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={editingMember.is_active}
                onChange={(e) =>
                  setEditingMember((prev) => ({ ...prev, is_active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Visible on About page
              </Label>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMember.id ? "Save Changes" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this team member? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
