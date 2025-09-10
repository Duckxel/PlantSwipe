import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { getUserGardens, createGarden } from '@/lib/gardens'
import type { Garden } from '@/types/garden'
import { useNavigate } from 'react-router-dom'

export const GardenListPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [gardens, setGardens] = React.useState<Garden[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!user?.id) { setGardens([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserGardens(user.id)
      setGardens(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load gardens')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => { load() }, [load])

  const onCreate = async () => {
    if (!user?.id) return
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      const garden = await createGarden({ name: name.trim(), coverImageUrl: imageUrl.trim() || null, ownerUserId: user.id })
      setOpen(false)
      setName('')
      setImageUrl('')
      // Navigate to the new garden dashboard
      navigate(`/garden/${garden.id}`)
    } catch (e: any) {
      setError(e?.message || 'Failed to create garden')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <div className="flex items-center justify-between mt-6 mb-4">
        <h1 className="text-2xl font-semibold">Your Gardens</h1>
        {user && (
          <Button className="rounded-2xl" onClick={() => setOpen(true)}>Create Garden</Button>
        )}
      </div>
      {loading && <div className="p-6 opacity-60 text-sm">Loading…</div>}
      {error && <div className="p-6 text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gardens.map(g => (
            <Card key={g.id} className="rounded-2xl overflow-hidden">
              <button onClick={() => navigate(`/garden/${g.id}`)} className="grid grid-cols-3 gap-0 w-full text-left">
                <div className="col-span-1 h-36 bg-cover bg-center" style={{ backgroundImage: `url(${g.coverImageUrl || ''})` }} />
                <div className="col-span-2 p-4">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs opacity-60">Created {new Date(g.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
      {!loading && !error && gardens.length === 0 && (
        <div className="p-10 text-center opacity-60 text-sm">No gardens yet. Create your first garden to get started.</div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create a Garden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="My balcony garden" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Cover image URL (optional)</label>
              <Input value={imageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-2xl" onClick={onCreate} disabled={!name.trim() || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

