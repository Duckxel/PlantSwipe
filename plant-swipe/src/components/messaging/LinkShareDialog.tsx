/**
 * LinkShareDialog Component
 * 
 * Dialog to share links to plants, gardens, bookmarks, profiles, or external URLs.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Link as LinkIcon,
  Leaf,
  Home,
  Bookmark,
  ExternalLink,
  Search,
  Loader2,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { generateShareLink } from '@/lib/messaging'
import type { LinkType, LinkPreview } from '@/types/messaging'

interface LinkShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShare: (link: { type: LinkType; id: string; url: string; preview?: LinkPreview }) => void
}

type TabType = 'plants' | 'gardens' | 'bookmarks' | 'url'

interface SearchResult {
  id: string
  name: string
  type: LinkType
  imageUrl?: string
  description?: string
}

export const LinkShareDialog: React.FC<LinkShareDialogProps> = ({
  open,
  onOpenChange,
  onShare
}) => {
  const { t } = useTranslation('common')
  
  const [activeTab, setActiveTab] = React.useState<TabType>('plants')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [externalUrl, setExternalUrl] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  
  // Search based on active tab
  React.useEffect(() => {
    if (!open) return
    if (activeTab === 'url') return
    
    const search = async () => {
      if (!searchQuery.trim() && activeTab !== 'gardens' && activeTab !== 'bookmarks') {
        setResults([])
        return
      }
      
      setLoading(true)
      
      try {
        let data: SearchResult[] = []
        
        if (activeTab === 'plants') {
          const { data: plants } = await supabase
            .from('plants')
            .select('id, name')
            .ilike('name', `%${searchQuery}%`)
            .limit(10)
          
          if (plants) {
            // Get images for these plants
            const plantIds = plants.map(p => p.id)
            const { data: images } = await supabase
              .from('plant_images')
              .select('plant_id, url')
              .in('plant_id', plantIds)
              .eq('is_primary', true)
            
            const imageMap = new Map((images || []).map(i => [i.plant_id, i.url]))
            
            data = plants.map(p => ({
              id: p.id,
              name: p.name,
              type: 'plant' as LinkType,
              imageUrl: imageMap.get(p.id)
            }))
          }
        } else if (activeTab === 'gardens') {
          const session = (await supabase.auth.getSession()).data.session
          if (!session?.user?.id) return
          
          const { data: memberships } = await supabase
            .from('garden_members')
            .select('garden_id')
            .eq('user_id', session.user.id)
          
          if (memberships && memberships.length > 0) {
            const gardenIds = memberships.map(m => m.garden_id)
            let query = supabase
              .from('gardens')
              .select('id, name, cover_image_url')
              .in('id', gardenIds)
            
            if (searchQuery.trim()) {
              query = query.ilike('name', `%${searchQuery}%`)
            }
            
            const { data: gardens } = await query.limit(10)
            
            if (gardens) {
              data = gardens.map(g => ({
                id: g.id,
                name: g.name,
                type: 'garden' as LinkType,
                imageUrl: g.cover_image_url
              }))
            }
          }
        } else if (activeTab === 'bookmarks') {
          const session = (await supabase.auth.getSession()).data.session
          if (!session?.user?.id) return
          
          let query = supabase
            .from('bookmarks')
            .select('id, name, cover_image_url')
            .eq('user_id', session.user.id)
          
          if (searchQuery.trim()) {
            query = query.ilike('name', `%${searchQuery}%`)
          }
          
          const { data: bookmarks } = await query.limit(10)
          
          if (bookmarks) {
            data = bookmarks.map(b => ({
              id: b.id,
              name: b.name,
              type: 'bookmark' as LinkType,
              imageUrl: b.cover_image_url
            }))
          }
        }
        
        setResults(data)
      } catch (e) {
        console.error('[link-share] Search failed:', e)
      } finally {
        setLoading(false)
      }
    }
    
    const timeout = setTimeout(search, 300)
    return () => clearTimeout(timeout)
  }, [open, activeTab, searchQuery])
  
  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setExternalUrl('')
      setResults([])
      setSelectedId(null)
    }
  }, [open])
  
  // Handle selecting a result
  const handleSelect = (result: SearchResult) => {
    const url = generateShareLink(result.type, result.id)
    onShare({
      type: result.type,
      id: result.id,
      url,
      preview: {
        title: result.name,
        image: result.imageUrl,
        description: result.description
      }
    })
  }
  
  // Handle sharing external URL
  const handleShareUrl = () => {
    if (!externalUrl.trim()) return
    
    try {
      new URL(externalUrl) // Validate URL
      onShare({
        type: 'external',
        id: externalUrl,
        url: externalUrl,
        preview: {
          title: new URL(externalUrl).hostname
        }
      })
    } catch {
      // Invalid URL
    }
  }
  
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'plants', label: t('messages.shareTab.plants', { defaultValue: 'Plants' }), icon: <Leaf className="h-4 w-4" /> },
    { id: 'gardens', label: t('messages.shareTab.gardens', { defaultValue: 'Gardens' }), icon: <Home className="h-4 w-4" /> },
    { id: 'bookmarks', label: t('messages.shareTab.bookmarks', { defaultValue: 'Bookmarks' }), icon: <Bookmark className="h-4 w-4" /> },
    { id: 'url', label: t('messages.shareTab.url', { defaultValue: 'URL' }), icon: <ExternalLink className="h-4 w-4" /> }
  ]
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-500" />
            {t('messages.shareLink', { defaultValue: 'Share a Link' })}
          </DialogTitle>
          <DialogDescription>
            {t('messages.shareLinkDescription', { defaultValue: 'Share plants, gardens, or external links' })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-stone-100 dark:bg-[#2a2a2d] rounded-xl">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                  setResults([])
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-[#1f1f1f] shadow-sm text-stone-900 dark:text-white'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          
          {/* Content based on tab */}
          {activeTab === 'url' ? (
            <div className="space-y-4">
              <Input
                placeholder={t('messages.enterUrl', { defaultValue: 'https://example.com' })}
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="rounded-xl"
              />
              <Button
                className="w-full rounded-xl"
                onClick={handleShareUrl}
                disabled={!externalUrl.trim()}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {t('messages.share', { defaultValue: 'Share' })}
              </Button>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  placeholder={t('messages.search', { defaultValue: 'Search...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              
              {/* Results */}
              <div className="max-h-[250px] overflow-y-auto space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {searchQuery 
                        ? t('messages.noResults', { defaultValue: 'No results found' })
                        : t('messages.startTyping', { defaultValue: 'Start typing to search...' })
                      }
                    </p>
                  </div>
                ) : (
                  results.map(result => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                        'hover:bg-stone-50 dark:hover:bg-[#2a2a2d]',
                        selectedId === result.id && 'bg-blue-50 dark:bg-blue-900/20'
                      )}
                    >
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-stone-200 dark:bg-[#3e3e42] flex items-center justify-center flex-shrink-0">
                          {result.type === 'plant' && <Leaf className="h-5 w-5 text-stone-500" />}
                          {result.type === 'garden' && <Home className="h-5 w-5 text-stone-500" />}
                          {result.type === 'bookmark' && <Bookmark className="h-5 w-5 text-stone-500" />}
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-stone-900 dark:text-white truncate">
                          {result.name}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 capitalize">
                          {result.type}
                        </p>
                      </div>
                      <Check className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
