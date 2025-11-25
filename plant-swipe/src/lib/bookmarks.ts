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
  // Filter out invalid IDs (must be valid UUIDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const allPlantIds = new Set<string>()
  data?.forEach((b: any) => {
    b.items?.forEach((i: any) => {
      if (i.plant_id) {
        const plantId = String(i.plant_id).trim()
        // Only add valid UUIDs
        if (plantId && uuidRegex.test(plantId)) {
          allPlantIds.add(plantId)
        }
      }
    })
  })

  // If there are plants, fetch their images
  const plantImagesMap: Record<string, string | null> = {}
  if (allPlantIds.size > 0) {
    const plantIdsArray = Array.from(allPlantIds)
    
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
    if (plantImages) {
      plantImages.forEach((img: any) => {
        if (!img.plant_id || !img.link) return
        const pid = String(img.plant_id).trim()
        if (!imagesByPlantId[pid]) imagesByPlantId[pid] = []
        imagesByPlantId[pid].push({ link: img.link, use: img.use || 'other' })
      })
    }

    // Build the image URL map for each plant
    allPlantIds.forEach((plantId) => {
      const images = imagesByPlantId[plantId] || []
      
      if (images.length > 0) {
        const photos = images.map((img) => ({
          url: img.link || '',
          isPrimary: img.use === 'primary',
          isVertical: false
        }))
        
        // Get primary photo URL or fallback to first image
        let url = getPrimaryPhotoUrl(photos)
        if (!url && images.length > 0 && images[0]?.link) url = images[0].link
        
        plantImagesMap[plantId] = url || null
      }
    })
  }

  return (data || []).map((b: any) => {
    // Store original count before filtering
    const originalCount = (b.items || []).length
    
    // Filter items to only include valid UUIDs for image fetching
    const validItems = (b.items || [])
      .filter((i: any) => i.plant_id && uuidRegex.test(String(i.plant_id).trim()))
      .map((i: any) => ({
        id: i.id,
        bookmark_id: b.id,
        plant_id: String(i.plant_id).trim(), // Ensure string and valid UUID
        created_at: i.created_at
      }))
    
    // Collect up to 3 images for collage (first 3 plants, already ordered by created_at)
    const preview_images: string[] = []
    
    for (const item of validItems) {
      const imageUrl = plantImagesMap[item.plant_id]
      if (imageUrl) {
        preview_images.push(imageUrl)
        if (preview_images.length >= 3) break
      }
    }

    // Map all items (including invalid ones) for the items array, but use original count
    const allItems = (b.items || []).map((i: any) => ({
      id: i.id,
      bookmark_id: b.id,
      plant_id: String(i.plant_id || ''), // Keep all items, even if invalid
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
  const { data, error } = await supabase
    .from('bookmark_items')
    .insert({ bookmark_id: bookmarkId, plant_id: plantId })
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

export async function getBookmarkDetails(bookmarkId: string): Promise<Bookmark> {
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
  let plantsMap: Record<string, Plant> = {}
  
  if (plantIds.length > 0) {
    const { data: plantRows, error: pErr } = await supabase
      .from('plants')
      .select('*, plant_images(link, use)')
      .in('id', plantIds)
    
    if (!pErr && plantRows) {
      plantRows.forEach((p: any) => {
          const images = Array.isArray(p.plant_images) ? p.plant_images : []
          const photos = images.map((img: any) => ({
            url: img.link || '',
            isPrimary: img.use === 'primary',
            isVertical: false
          }))
          // Basic mapping, assuming standard Plant type fields
          plantsMap[p.id] = {
              ...p,
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
