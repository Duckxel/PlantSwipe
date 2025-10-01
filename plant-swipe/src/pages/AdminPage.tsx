import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Server, Database, Github, ExternalLink } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'

export const AdminPage: React.FC = () => {

  const [syncing, setSyncing] = React.useState(false)
  
  const [backingUp, setBackingUp] = React.useState(false)

  const [restarting, setRestarting] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)

  const runSyncSchema = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        alert('You must be signed in to run schema sync')
        return
      }
      // Try GET first to avoid 405s from proxies that block POST
      let resp = await fetch('/api/admin/sync-schema', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (resp.status === 405) {
        // Fallback to POST if GET is blocked
        resp = await fetch('/api/admin/sync-schema', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      }
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(body?.error || `Request failed (${resp.status})`)
      }
      alert('Schema synchronized successfully')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to sync schema: ${message}`)
    } finally {
      setSyncing(false)
    }
  }

  const restartServer = async () => {
    if (restarting) return
    setRestarting(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        alert('You must be signed in to restart the server')
        return
      }
      const resp = await fetch('/api/admin/restart-server', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(body?.error || `Request failed (${resp.status})`)
      }
      // Give the server a moment to restart, then reload client
      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to restart server: ${message}`)
    } finally {
      setRestarting(false)
    }
  }

  const [onlineCount, setOnlineCount] = React.useState<number>(0)
  const [registeredCount, setRegisteredCount] = React.useState<number | null>(null)

  const pullLatest = async () => {
    if (pulling) return
    setPulling(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/admin/pull-code', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        let body: any = {}
        try {
          body = await res.json()
        } catch {
          const text = await res.text().catch(() => '')
          throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
        }
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      setTimeout(() => { window.location.reload() }, 800)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Failed to pull & build: ${message}`)
    } finally {
      setPulling(false)
    }
  }

  const runBackup = async () => {
    if (backingUp) return
    setBackingUp(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) {
        alert('You must be signed in to back up the database')
        return
      }

      const start = await fetch('/api/admin/backup-db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const startBody: { token?: string; filename?: string; error?: string } = await start.json().catch(() => ({} as { token?: string; filename?: string; error?: string }))
      if (!start.ok) {
        throw new Error(startBody?.error || `Backup failed (${start.status})`)
      }
      const dlToken = startBody?.token
      const filename: string = startBody?.filename || 'backup.sql.gz'
      if (!dlToken) throw new Error('Missing download token from server')

      const downloadUrl = `/api/admin/download-backup?token=${encodeURIComponent(dlToken)}`
      const resp = await fetch(downloadUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!resp.ok) {
        const errBody: { error?: string } = await resp.json().catch(() => ({} as { error?: string }))
        throw new Error(errBody?.error || `Download failed (${resp.status})`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`Backup failed: ${message}`)
    } finally {
      setBackingUp(false)
    }
  }

  // Subscribe to global presence channel and compute unique users online
  React.useEffect(() => {
    const channel = supabase.channel('global-presence', { config: { presence: { key: `admin_${Math.random().toString(36).slice(2,8)}` } } })
    const compute = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
      const uniqueIds = new Set<string>()
      for (const [key] of Object.entries(state)) {
        // presence key may be anon_* or a user id
        uniqueIds.add(key)
        // no-op; counting by key is enough for unique connections per user
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

  // Fetch total registered accounts (admin API first to bypass RLS; fallback to client count)
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const resp = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } })
          if (resp.ok) {
            const data = await resp.json().catch(() => ({}))
            const val = typeof data?.profilesCount === 'number' ? data.profilesCount : null
            if (!cancelled && val !== null) { setRegisteredCount(val); return }
          }
        }
      } catch {}
      // Fallback: client-side count (will be limited by RLS to own row)
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
            <div className="text-sm opacity-60 mt-1">Admin actions: monitor and manage infrastructure.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="rounded-2xl w-full" onClick={restartServer} disabled={restarting}>
              <Server className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>{restarting ? 'Restarting…' : 'Restart Server'}</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="secondary" onClick={pullLatest} disabled={pulling}>
              <Github className="h-4 w-4" />
              <RefreshCw className="h-4 w-4" />
              <span>{pulling ? 'Pulling…' : 'Pull & Build'}</span>
            </Button>
            <Button className="rounded-2xl w-full" variant="destructive" onClick={runSyncSchema} disabled={syncing}>
              <Database className="h-4 w-4" />
              <span>{syncing ? 'Syncing Schema…' : 'Sync DB Schema'}</span>
            </Button>
            <Button className="rounded-2xl w-full" onClick={runBackup} disabled={backingUp}>
              <Database className="h-4 w-4" />
              <span>{backingUp ? 'Creating Backup…' : 'Backup DB'}</span>
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
                <a href="https://github.com/Duckxel/PlantSwipe" target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://supabase.com/dashboard/project/lxnkcguwewrskqnyzjwi" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                  <span>Supabase</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://cloud.linode.com/linodes/84813440/metrics" target="_blank" rel="noreferrer">
                  <span className="inline-block h-3 w-3 rounded-sm bg-blue-600" />
                  <span>Linode</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

export default AdminPage

