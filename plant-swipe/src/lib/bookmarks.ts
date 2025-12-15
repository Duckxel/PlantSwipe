import { supabase } from '@/lib/supabaseClient'
import type { Bookmark, BookmarkItem, BookmarkVisibility } from '@/types/bookmark'
import type { Plant } from '@/types/plant'
import { getPrimaryPhotoUrl } from '@/lib/photos'

export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      *,
      items:bookmark_items(
        id,
        plant_id,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  
  // Order items by created_at for each bookmark
  if (data) {
    data.forEach((b: any) => {
      if (b.items) {
        b.items.sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }
    })
  }

  // For each bookmark, we might want to fetch a few plant images for the collage
  // To avoid N+1 queries, we can collect all unique plant IDs first
  // Accept both UUIDs and numeric IDs (for legacy plants)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const numericIdRegex = /^\d+$/
  const isValidPlantId = (id: string): boolean => {
    return uuidRegex.test(id) || numericIdRegex.test(id)
  }
  
  const allPlantIds = new Set<string>()
  data?.forEach((b: any) => {
    if (b.items && Array.isArray(b.items)) {
      b.items.forEach((i: any) => {
        // Filter out null, undefined, or empty plant_ids
        if (i && i.plant_id != null && i.plant_id !== '') {
          const plantId = String(i.plant_id).trim()
          // Accept valid UUIDs or numeric IDs (for legacy plants like ID 0)
          if (plantId && plantId !== 'null' && plantId !== 'undefined' && isValidPlantId(plantId)) {
            allPlantIds.add(plantId)
          }
        }
      })
    }
  })

  // If there are plants, fetch their images
  const plantImagesMap: Record<string, string | null> = {}
  if (allPlantIds.size > 0) {
    const plantIdsArray = Array.from(allPlantIds).filter(id => id && id.trim())
    
    if (plantIdsArray.length > 0) {
      try {
        // Fetch plant_images for all plants
        const { data: plantImages, error: imagesError } = await supabase
          .from('plant_images')
          .select('plant_id, link, use')
          .in('plant_id', plantIdsArray)
        
        if (imagesError) {
          console.error('Error fetching plant images for bookmarks:', imagesError)
        }

        // Build a map of plant_id -> images
        const imagesByPlantId: Record<string, Array<{ link: string; use: string }>> = {}
        if (plantImages && Array.isArray(plantImages)) {
          plantImages.forEach((img: any) => {
            if (!img || !img.plant_id || !img.link) return
            const pid = String(img.plant_id).trim()
            // Accept both UUIDs and numeric IDs
            if (!pid || !isValidPlantId(pid)) return
            const link = String(img.link).trim()
            if (!link) return
            
            if (!imagesByPlantId[pid]) imagesByPlantId[pid] = []
            imagesByPlantId[pid].push({ 
              link: link, 
              use: img.use || 'other' 
            })
          })
        }

        // Build the image URL map for each plant
        allPlantIds.forEach((plantId) => {
          const images = imagesByPlantId[plantId] || []
          
          if (images.length > 0) {
            const photos = images
              .filter(img => img && img.link && img.link.trim())
              .map((img) => ({
                url: img.link.trim(),
                isPrimary: img.use === 'primary',
                isVertical: false
              }))
            
            if (photos.length > 0) {
              // Get primary photo URL or fallback to first image
              let url = getPrimaryPhotoUrl(photos)
              if (!url && photos.length > 0 && photos[0]?.url) {
                url = photos[0].url
              }
              
              if (url && url.trim()) {
                plantImagesMap[plantId] = url.trim()
              }
            }
          }
        })
      } catch (error) {
        console.error('Error processing plant images for bookmarks:', error)
      }
    }
  }

  return (data || []).map((b: any) => {
    // Filter out items with null/invalid plant_ids for counting
    const validItemsForCount = (b.items || []).filter((i: any) => {
      if (!i || i.plant_id == null || i.plant_id === '') return false
      const plantId = String(i.plant_id).trim()
      return plantId && plantId !== 'null' && plantId !== 'undefined' && isValidPlantId(plantId)
    })
    const originalCount = validItemsForCount.length
    
    // Filter items to only include valid IDs (UUIDs or numeric) for image fetching
    const validItems = (b.items || [])
      .filter((i: any) => {
        if (!i || i.plant_id == null || i.plant_id === '') return false
        const plantId = String(i.plant_id).trim()
        return plantId && plantId !== 'null' && plantId !== 'undefined' && isValidPlantId(plantId)
      })
      .map((i: any) => ({
        id: i.id,
        bookmark_id: b.id,
        plant_id: String(i.plant_id).trim(),
        created_at: i.created_at
      }))
    
    // Collect up to 3 images for collage (first 3 plants, already ordered by created_at)
    const preview_images: string[] = []
    
    for (const item of validItems) {
      const imageUrl = plantImagesMap[item.plant_id]
      if (imageUrl && imageUrl.trim()) {
        preview_images.push(imageUrl.trim())
        if (preview_images.length >= 3) break
      }
    }

    // Map only valid items for the items array
    const allItems = validItems.map((i: any) => ({
      id: i.id,
      bookmark_id: b.id,
      plant_id: i.plant_id,
      created_at: i.created_at
    }))

    return {
      id: b.id,
      user_id: b.user_id,
      name: b.name,
      visibility: b.visibility,
      created_at: b.created_at,
      updated_at: b.updated_at,
      items: allItems, // Return all items
      plant_count: originalCount, // Use original count
      preview_images
    }
  })
}

export async function createBookmark(userId: string, name: string, visibility: BookmarkVisibility = 'public'): Promise<Bookmark> {
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, name, visibility })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateBookmark(bookmarkId: string, updates: Partial<Pick<Bookmark, 'name' | 'visibility'>>): Promise<Bookmark> {
  const { data, error } = await supabase
    .from('bookmarks')
    .update(updates)
    .eq('id', bookmarkId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', bookmarkId)

  if (error) throw new Error(error.message)
}

export async function addPlantToBookmark(bookmarkId: string, plantId: string): Promise<BookmarkItem> {
  // Ensure plantId is a valid string (handles numeric IDs like "0" for legacy plants)
  const validPlantId = String(plantId).trim()
  if (!validPlantId || validPlantId === 'null' || validPlantId === 'undefined') {
    throw new Error('Invalid plant ID')
  }
  
  const { data, error } = await supabase
    .from('bookmark_items')
    .insert({ bookmark_id: bookmarkId, plant_id: validPlantId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function removePlantFromBookmark(bookmarkId: string, plantId: string): Promise<void> {
  const { error } = await supabase
    .from('bookmark_items')
    .delete()
    .eq('bookmark_id', bookmarkId)
    .eq('plant_id', plantId)

  if (error) throw new Error(error.message)
}

export async function getBookmarkDetails(bookmarkId: string, language: string = 'en'): Promise<Bookmark> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      *,
      items:bookmark_items(
        id,
        plant_id,
        created_at
      )
    `)
    .eq('id', bookmarkId)
    .single()

  if (error) throw new Error(error.message)

  // Fetch full plant details for items
  const plantIds = (data.items || []).map((i: any) => i.plant_id)
  const plantsMap: Record<string, Plant> = {}
  
  if (plantIds.length > 0) {
    // Load plants base data
    const { data: plantRows, error: pErr } = await supabase
      .from('plants')
      .select('*, plant_images(link, use)')
      .in('id', plantIds)
    
    // Load translations for the requested language
    const { data: translations } = await supabase
      .from('plant_translations')
      .select('*')
      .eq('language', language)
      .in('plant_id', plantIds)
    
    const translationMap = new Map<string, any>()
    if (translations) {
      translations.forEach((t: any) => translationMap.set(t.plant_id, t))
    }
    
    if (!pErr && plantRows) {
      plantRows.forEach((p: any) => {
          const translation = translationMap.get(p.id) || {}
          const images = Array.isArray(p.plant_images) ? p.plant_images : []
          const photos = images.map((img: any) => ({
            url: img.link || '',
            isPrimary: img.use === 'primary',
            isVertical: false
          }))
          // Merge translation with base plant data
          plantsMap[p.id] = {
              ...p,
              name: translation.name || p.name,
              photos,
              image: getPrimaryPhotoUrl(photos) || p.image_url || images[0]?.link
          } as Plant
      })
    }
  }

  const items = (data.items || []).map((i: any) => ({
    id: i.id,
    bookmark_id: data.id,
    plant_id: i.plant_id,
    created_at: i.created_at,
    plant: plantsMap[i.plant_id]
  }))

  const preview_images = items
      .map((i: BookmarkItem) => i.plant?.image)
      .filter((url: string | undefined) => !!url)
      .slice(0, 4) as string[]

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    visibility: data.visibility,
    created_at: data.created_at,
    updated_at: data.updated_at,
    items,
    plant_count: items.length,
    preview_images
  }
}
