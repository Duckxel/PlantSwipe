import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { disableRealtime, ensureRealtimeReady } from '@/lib/supabaseRealtimeGuard'

export type GardenRealtimeKind =
  | 'tasks'
  | 'plants'
  | 'members'
  | 'activity'
  | 'settings'
  | 'inventory'
  | 'general'

export type GardenBroadcastMessage = {
  gardenId: string
  kind: GardenRealtimeKind
  metadata?: Record<string, unknown>
  actorId?: string | null
  timestamp: string
}

type Listener = (message: GardenBroadcastMessage) => void

const listeners = new Set<Listener>()

let broadcastChannel: RealtimeChannel | null = null
let isSubscribed = false
let creationPromise: Promise<RealtimeChannel | null> | null = null

async function createChannel(): Promise<RealtimeChannel | null> {
  const ready = await ensureRealtimeReady()
  if (!ready) return null
  try {
    const channel = supabase.channel('garden-broadcast', {
      config: {
        broadcast: { ack: true },
      },
    })

    channel.on('broadcast', { event: 'garden:update' }, (payload) => {
      const message = payload?.payload as GardenBroadcastMessage | undefined
      if (!message?.gardenId) return
      for (const listener of listeners) {
        try {
          listener(message)
        } catch (e) {
          // Swallow listener errors to avoid breaking other subscribers
          console.error('[garden-broadcast] listener failed', e)
        }
      }
    })

    return channel
  } catch (error) {
    disableRealtime('channel-create')
    console.warn('[garden-broadcast] realtime disabled; falling back to local-only updates', error)
    return null
  }
}

async function ensureChannel(): Promise<RealtimeChannel | null> {
  if (broadcastChannel) return broadcastChannel
  if (!creationPromise) {
    creationPromise = createChannel()
      .then((channel) => {
        broadcastChannel = channel
        return channel
      })
      .finally(() => {
        creationPromise = null
      })
  }
  return creationPromise
}

async function ensureSubscribed(): Promise<boolean> {
  if (isSubscribed && broadcastChannel) return true
  const channel = await ensureChannel()
  if (!channel) return false
  if (isSubscribed) return true
  const result = channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isSubscribed = true
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      isSubscribed = false
    }
  })
  if ((result as RealtimeChannel | undefined)?.state === 'joined') {
    isSubscribed = true
  } else if (result instanceof Promise) {
    result.catch(() => {})
  }
  return isSubscribed
}

export async function addGardenBroadcastListener(listener: Listener): Promise<() => Promise<void>> {
  listeners.add(listener)
  const subscribed = await ensureSubscribed()
  if (!subscribed) {
    return async () => {
      listeners.delete(listener)
    }
  }
  return async () => {
    listeners.delete(listener)
    if (listeners.size === 0 && broadcastChannel) {
      try {
        await supabase.removeChannel(broadcastChannel)
      } catch {}
      broadcastChannel = null
      isSubscribed = false
    }
  }
}

export async function broadcastGardenUpdate(message: Omit<GardenBroadcastMessage, 'timestamp'>): Promise<void> {
  const subscribed = await ensureSubscribed()
  if (!subscribed || !broadcastChannel) return
  const payload: GardenBroadcastMessage = {
    ...message,
    timestamp: new Date().toISOString(),
  }
  try {
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'garden:update',
      payload,
    })
  } catch (error) {
    console.error('[garden-broadcast] failed to send update', error)
  }
}

export function hasGardenBroadcastListeners(): boolean {
  return listeners.size > 0
}

