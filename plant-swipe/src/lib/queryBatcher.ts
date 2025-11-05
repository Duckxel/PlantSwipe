/**
 * Query Batching Utility
 * Batches multiple small queries into single requests to reduce egress overhead
 */
import { supabase } from './supabaseClient'

interface BatchedQuery<T> {
  id: string
  query: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

class QueryBatcher {
  private batch: BatchedQuery<any>[] = []
  private batchTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly BATCH_DELAY_MS = 50 // Wait 50ms to collect queries
  private readonly MAX_BATCH_SIZE = 10 // Process max 10 queries at once

  private async processBatch() {
    if (this.batch.length === 0) return

    const queriesToProcess = this.batch.splice(0, this.MAX_BATCH_SIZE)
    
    // Process queries in parallel
    const results = await Promise.allSettled(
      queriesToProcess.map(q => q.query())
    )

    results.forEach((result, index) => {
      const { resolve, reject } = queriesToProcess[index]
      if (result.status === 'fulfilled') {
        resolve(result.value)
      } else {
        reject(result.reason || new Error('Query failed'))
      }
    })

    // If there are more queries, schedule next batch
    if (this.batch.length > 0) {
      this.scheduleBatch()
    }
  }

  private scheduleBatch() {
    if (this.batchTimeout) return
    
    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null
      this.processBatch()
    }, this.BATCH_DELAY_MS)
  }

  async add<T>(id: string, query: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.batch.push({ id, query, resolve, reject })
      
      if (this.batch.length >= this.MAX_BATCH_SIZE) {
        // Process immediately if batch is full
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout)
          this.batchTimeout = null
        }
        this.processBatch()
      } else {
        this.scheduleBatch()
      }
    })
  }

  flush() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    this.processBatch()
  }
}

// Global batcher instance
export const queryBatcher = new QueryBatcher()

/**
 * Batch multiple profile lookups into a single query
 */
export async function batchGetProfiles(userIds: string[]): Promise<Map<string, { id: string; display_name: string | null }>> {
  if (userIds.length === 0) return new Map()
  
  // Remove duplicates
  const uniqueIds = Array.from(new Set(userIds))
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', uniqueIds)
  
  if (error) throw new Error(error.message)
  
  const map = new Map<string, { id: string; display_name: string | null }>()
  for (const p of data || []) {
    map.set(String(p.id), {
      id: String(p.id),
      display_name: p.display_name || null
    })
  }
  
  return map
}

/**
 * Batch multiple plant lookups (lightweight - IDs only)
 */
export async function batchGetPlantIds(plantNames: string[]): Promise<Map<string, string>> {
  if (plantNames.length === 0) return new Map()
  
  const uniqueNames = Array.from(new Set(plantNames.map(n => n.trim()).filter(Boolean)))
  if (uniqueNames.length === 0) return new Map()
  
  const { data, error } = await supabase
    .from('plants')
    .select('id, name')
    .in('name', uniqueNames)
  
  if (error) throw new Error(error.message)
  
  const map = new Map<string, string>()
  for (const p of data || []) {
    map.set(String(p.name).toLowerCase(), String(p.id))
  }
  
  return map
}
