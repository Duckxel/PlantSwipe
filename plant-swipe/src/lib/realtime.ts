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

let broadcastChannel: RealtimeChannel = createChannel()
let subscribePromise: Promise<RealtimeChannel> | null = null

function createChannel(): RealtimeChannel {
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
}

async function ensureSubscribed(): Promise<RealtimeChannel> {
  if (!subscribePromise) {
    subscribePromise = broadcastChannel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscribePromise = null
      }
    })
  }
  return subscribePromise
}

export async function addGardenBroadcastListener(listener: Listener): Promise<() => Promise<void>> {
  listeners.add(listener)
  await ensureSubscribed()
  return async () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      try {
        await supabase.removeChannel(broadcastChannel)
      } catch {}
      broadcastChannel = createChannel()
      subscribePromise = null
    }
  }
}

export async function broadcastGardenUpdate(message: Omit<GardenBroadcastMessage, 'timestamp'>): Promise<void> {
  await ensureSubscribed()
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

