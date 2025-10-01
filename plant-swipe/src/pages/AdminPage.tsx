import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Server, Database, Github, ExternalLink, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export const AdminPage: React.FC = () => {
  const notImplemented = (msg: string) => () => {
    alert(`${msg} – UI only for now`)
  }

  const [onlineCount, setOnlineCount] = React.useState<number>(0)
  const [registeredCount, setRegisteredCount] = React.useState<number | null>(null)

  // Git controls state
  const [branchesOpen, setBranchesOpen] = React.useState(false)
  const [loadingBranches, setLoadingBranches] = React.useState(false)
  const [branches, setBranches] = React.useState<string[]>([])
  const [currentBranch, setCurrentBranch] = React.useState<string>("")
  const [selectedBranch, setSelectedBranch] = React.useState<string>("")
  const [pulling, setPulling] = React.useState(false)
  const [pullDone, setPullDone] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const { profile } = useAuth()

  const openBranchDialog = async () => {
    setBranchesOpen(true)
    setApiError(null)
    setLoadingBranches(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/admin/branches', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      })
      if (res.status === 403) {
        setApiError('Forbidden. Provide Admin API token to proceed.')
        setBranches([])
        setCurrentBranch("")
        setSelectedBranch("")
        return
      }
      if (!res.ok) throw new Error(`Failed to load branches (${res.status})`)
      const data = await res.json()
      const list: string[] = Array.isArray(data?.branches) ? data.branches : []
      const cur: string = typeof data?.current === 'string' ? data.current : ""
      setBranches(list)
      setCurrentBranch(cur)
      setSelectedBranch(cur && list.includes(cur) ? cur : (list[0] || ""))
    } catch (e: any) {
      setApiError(e?.message || 'Failed to load branches')
    } finally {
      setLoadingBranches(false)
    }
  }

  const executePull = async () => {
    setApiError(null)
    setPulling(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const url = `/api/admin/pull-code?branch=${encodeURIComponent(selectedBranch)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      })
      if (res.status === 403) {
        setApiError('Forbidden. Provide Admin API token to proceed.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Pull failed (${res.status})`)
      }
      setPullDone(true)
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch (e: any) {
      setApiError(e?.message || 'Pull failed')
    } finally {
      setPulling(false)
    }
  }

  // Subscribe to global presence channel and compute unique users online
  React.useEffect(() => {
    const channel = supabase.channel('global-presence', { config: { presence: { key: `admin_${Math.random().toString(36).slice(2,8)}` } } })
    const compute = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
      const uniqueIds = new Set<string>()
      for (const [key, metas] of Object.entries(state)) {
        // presence key may be anon_* or a user id
        uniqueIds.add(key)
        for (const _meta of metas) {
          // no-op; counting by key is enough for unique connections per user
        }
      }
      setOnlineCount(uniqueIds.size)
    }
    channel.on('presence', { event: 'sync' }, compute)
    channel.on('presence', { event: 'join' }, compute)
    channel.on('presence', { event: 'leave' }, compute)
    channel.subscribe(() => {
      // Track as admin observer (optional)
      channel.track({ role: 'admin_observer', online_at: new Date().toISOString() })
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Fetch total registered accounts from profiles table
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
      if (!cancelled) setRegisteredCount(error ? null : (count ?? 0))
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0">
      <Card className="rounded-3xl">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Admin Controls</div>
            <div className="text-sm opacity-60 mt-1">UI only. No actions are executed yet.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="rounded-2xl w-full" onClick={notImplemented('Restart server')}>
              <Server className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>Restart Server</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="secondary" onClick={openBranchDialog} disabled={!profile?.is_admin}>
              <Github className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>Pull Code</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="destructive" onClick={notImplemented('Reformat database')}>
              <Database className="h-4 w-4" />
              <span>Reformat Database</span>
            </Button>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-sm opacity-60">Currently online</div>
                  <div className="text-2xl font-semibold">{onlineCount}</div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-sm opacity-60">Registered accounts</div>
                  <div className="text-2xl font-semibold">{registeredCount ?? '—'}</div>
                </CardContent>
              </Card>
            </div>
            <div className="text-xs font-medium uppercase tracking-wide opacity-60 mb-2">Quick Links</div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://supabase.com" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                  <span>Supabase</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://cloud.linode.com" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-blue-600" />
                  <span>Linode</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={branchesOpen} onOpenChange={(o: boolean) => { setBranchesOpen(o); if (!o) { setApiError(null); setPullDone(false); } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pull latest code</DialogTitle>
            <DialogDescription>
              Select a branch to checkout and pull. Stale local branches will be deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm opacity-70">Branch</label>
              {loadingBranches ? (
                <div className="text-sm opacity-70">Loading branches…</div>
              ) : branches.length > 0 ? (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                  value={selectedBranch}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBranch(e.target.value)}
                >
                  {branches.map((b: string) => (
                    <option key={b} value={b}>
                      {b}{b === currentBranch ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm opacity-70">No branches found.</div>
              )}
              {apiError && <div className="text-sm text-red-600">{apiError}</div>}
            </div>

            {pullDone && (
              <div className="flex items-center gap-2 text-emerald-600">
                <Check className="h-4 w-4" />
                <span>Pull complete. Reloading…</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="secondary" className="rounded-2xl" onClick={() => setBranchesOpen(false)} disabled={pulling}>Close</Button>
              <Button className="rounded-2xl" onClick={openBranchDialog} disabled={pulling}>Refresh</Button>
              <Button className="rounded-2xl" onClick={executePull} disabled={pulling || !selectedBranch || loadingBranches}>
                {pulling ? 'Pulling…' : 'Pull'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPage

