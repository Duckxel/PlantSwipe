/**
 * ConversationMediaGallery Component
 * 
 * A full-screen gallery view for browsing all images shared in a conversation.
 * Features: grid view, fullscreen image viewing, swipe navigation.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConversationImages, type ConversationImage } from '@/lib/messaging'

interface ConversationMediaGalleryProps {
  conversationId: string
  otherUserDisplayName: string | null
  onClose: () => void
}

export const ConversationMediaGallery: React.FC<ConversationMediaGalleryProps> = ({
  conversationId,
  otherUserDisplayName,
  onClose
}) => {
  const { t } = useTranslation('common')
  
  const [images, setImages] = React.useState<ConversationImage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [imageLoadStates, setImageLoadStates] = React.useState<Record<string, boolean>>({})
  
  // Load images
  React.useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getConversationImages(conversationId)
        setImages(data)
      } catch (e: any) {
        console.error('[media-gallery] Failed to load images:', e)
        setError(e?.message || 'Failed to load images')
      } finally {
        setLoading(false)
      }
    }
    
    loadImages()
  }, [conversationId])
  
  // Keyboard navigation
  React.useEffect(() => {
    if (selectedIndex === null) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex(prev => prev !== null && prev < images.length - 1 ? prev + 1 : prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, images.length])
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }
  
  // Handle image load
  const handleImageLoad = (id: string) => {
    setImageLoadStates(prev => ({ ...prev, [id]: true }))
  }
  
  // Download image
  const downloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `conversation-image-${index + 1}.jpg`
    link.click()
  }
  
  // Navigate to previous/next
  const goToPrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }
  
  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }
  
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0f0f10]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1a1a1c] border-b border-stone-200/50 dark:border-[#2a2a2d]/50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              {t('messages.media', { defaultValue: 'Media' })}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {otherUserDisplayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
            </p>
          </div>
        </div>
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {images.length} {images.length === 1 
            ? t('messages.image', { defaultValue: 'image' })
            : t('messages.images', { defaultValue: 'images' })
          }
        </span>
      </header>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-300 dark:text-stone-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-100 dark:bg-[#2a2a2d] flex items-center justify-center mb-4">
              <ImageIcon className="h-10 w-10 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('messages.noMedia', { defaultValue: 'No media yet' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs">
              {t('messages.noMediaHint', { defaultValue: 'Photos you share in this conversation will appear here.' })}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {/* Grid of images */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedIndex(index)}
                  className="relative aspect-square overflow-hidden rounded-sm bg-stone-100 dark:bg-[#2a2a2d] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0f0f10]"
                >
                  <img
                    src={image.imageUrl}
                    alt={image.caption || ''}
                    className={cn(
                      "w-full h-full object-cover transition-opacity duration-200",
                      imageLoadStates[image.id] ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => handleImageLoad(image.id)}
                    loading="lazy"
                  />
                  {!imageLoadStates[image.id] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-stone-300 dark:border-stone-600 border-t-transparent animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Fullscreen viewer */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-60 bg-black flex flex-col"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Viewer header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedIndex(null)
                }}
              >
                <X className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-sm text-white font-medium">
                  {selectedImage.senderDisplayName || t('messages.unknownUser')}
                </p>
                <p className="text-xs text-white/70">
                  {formatDate(selectedImage.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70">
                {selectedIndex !== null ? selectedIndex + 1 : 0} / {images.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadImage(selectedImage.imageUrl, selectedIndex || 0)
                }}
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.caption || ''}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Caption */}
          {selectedImage.caption && (
            <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent absolute bottom-0 left-0 right-0">
              <p className="text-white text-center">{selectedImage.caption}</p>
            </div>
          )}
          
          {/* Navigation arrows */}
          {selectedIndex !== null && selectedIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {selectedIndex !== null && selectedIndex < images.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
