import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

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
let realtimeAvailable = true

function createChannel(): RealtimeChannel | null {
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

    realtimeAvailable = true
    return channel
  } catch (error) {
    realtimeAvailable = false
    console.warn('[garden-broadcast] realtime disabled; falling back to local-only updates', error)
    return null
  }
}

function ensureChannel(): RealtimeChannel | null {
  if (!realtimeAvailable) return null
  if (!broadcastChannel) broadcastChannel = createChannel()
  return broadcastChannel
}

function ensureSubscribed(): void {
  const channel = ensureChannel()
  if (!channel || isSubscribed) return
  const result = channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isSubscribed = true
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      isSubscribed = false
    }
  })
  if (result.state === 'joined') {
    isSubscribed = true
  }
}

export async function addGardenBroadcastListener(listener: Listener): Promise<() => Promise<void>> {
  listeners.add(listener)
  ensureSubscribed()
  return async () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      try {
        if (broadcastChannel) await supabase.removeChannel(broadcastChannel)
      } catch {}
      broadcastChannel = createChannel()
      isSubscribed = false
    }
  }
}

export async function broadcastGardenUpdate(message: Omit<GardenBroadcastMessage, 'timestamp'>): Promise<void> {
  ensureSubscribed()
  if (!realtimeAvailable || !broadcastChannel) return
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

