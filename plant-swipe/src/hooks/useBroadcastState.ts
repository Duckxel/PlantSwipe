import * as React from 'react'
import { broadcastStore, type BroadcastSnapshot } from '@/lib/broadcastStore'

export function useBroadcastState(): BroadcastSnapshot {
  React.useEffect(() => {
    broadcastStore.start()
  }, [])
  return React.useSyncExternalStore(
    broadcastStore.subscribe,
    broadcastStore.getSnapshot,
    broadcastStore.getSnapshot,
  )
}

export function useBroadcastActions() {
  return React.useMemo(() => {
    return {
      refresh: () => broadcastStore.refresh(),
      applyServerPayload: (payload: any, options?: { emitSeed?: boolean }) =>
        broadcastStore.applyServerPayload(payload, options),
      clear: (options?: { emitSeed?: boolean }) => broadcastStore.clear(options),
    }
  }, [])
}

