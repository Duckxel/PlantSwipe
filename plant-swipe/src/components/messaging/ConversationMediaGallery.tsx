/**
 * ConversationMediaGallery Component
 * 
 * A full-screen gallery view for browsing all images shared in a conversation.
 * Mobile-optimized with swipe gestures, easy download, and touch-friendly UI.
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
  Image as ImageIcon,
  Share2,
  Check
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
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = React.useState<string | null>(null)
  const [showControls, setShowControls] = React.useState(true)
  
  // Touch/swipe handling
  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null)
  const imageContainerRef = React.useRef<HTMLDivElement>(null)
  
  // Load images
  React.useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getConversationImages(conversationId)
        setImages(data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, images.length])
  
  // Auto-hide controls after 3s of inactivity in fullscreen
  React.useEffect(() => {
    if (selectedIndex === null) return
    
    const timer = setTimeout(() => {
      setShowControls(false)
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [selectedIndex, showControls])
  
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
  
  // Download image with feedback
  const downloadImage = async (image: ConversationImage, index: number) => {
    setDownloadingId(image.id)
    
    try {
      // Fetch the image as blob for better mobile support
      const response = await fetch(image.imageUrl)
      const blob = await response.blob()
      
      // Create a download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `image-${index + 1}-${formatDate(image.createdAt).replace(/\s/g, '-')}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      // Show success feedback
      setDownloadSuccess(image.id)
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
      
      setTimeout(() => setDownloadSuccess(null), 2000)
    } catch (err) {
      console.error('[media-gallery] Failed to download image:', err)
      // Fallback to direct link
      const link = document.createElement('a')
      link.href = image.imageUrl
      link.download = `image-${index + 1}.jpg`
      link.target = '_blank'
      link.click()
    } finally {
      setDownloadingId(null)
    }
  }
  
  // Share image (mobile native share)
  const shareImage = async (image: ConversationImage) => {
    if (!navigator.share) return
    
    try {
      // Try to share the image directly
      const response = await fetch(image.imageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'shared-image.jpg', { type: 'image/jpeg' })
      
      await navigator.share({
        files: [file],
        title: image.caption || t('messages.sharedImage', { defaultValue: 'Shared image' })
      })
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // If file sharing fails, try URL sharing
      if (err.name !== 'AbortError') {
        try {
          await navigator.share({
            url: image.imageUrl,
            title: image.caption || t('messages.sharedImage', { defaultValue: 'Shared image' })
          })
        } catch {
          // User cancelled or share failed
        }
      }
    }
  }
  
  // Navigate to previous/next
  const goToPrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
      setShowControls(true)
    }
  }
  
  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
      setShowControls(true)
    }
  }
  
  // Touch handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
  }
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const deltaTime = Date.now() - touchStartRef.current.time
    
    // Minimum swipe distance and speed
    const minSwipeDistance = 50
    const maxSwipeTime = 300
    
    // Check if it's a horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance && deltaTime < maxSwipeTime) {
      if (deltaX > 0) {
        // Swipe right -> previous
        goToPrevious()
      } else {
        // Swipe left -> next
        goToNext()
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
    
    touchStartRef.current = null
  }
  
  // Toggle controls on tap
  const handleImageTap = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't toggle if tapping on buttons
    if ((e.target as HTMLElement).closest('button')) return
    setShowControls(prev => !prev)
  }
  
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0f0f10]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-2 py-3 bg-white dark:bg-[#1a1a1c] border-b border-stone-200/50 dark:border-[#2a2a2d]/50 safe-area-top">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-11 w-11 min-w-11"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              {t('messages.media', { defaultValue: 'Media' })}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[150px]">
              {otherUserDisplayName || t('messages.unknownUser', { defaultValue: 'Unknown User' })}
            </p>
          </div>
        </div>
        <span className="text-sm text-stone-500 dark:text-stone-400 px-3">
          {images.length} {images.length === 1 
            ? t('messages.image', { defaultValue: 'image' })
            : t('messages.images', { defaultValue: 'images' })
          }
        </span>
      </header>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-300 dark:text-stone-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              className="mt-4 h-11"
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
          <div className="p-1.5">
            {/* Grid of images with download overlay */}
            <div className="grid grid-cols-3 gap-1">
              {images.map((image, index) => (
                <div key={image.id} className="relative group">
                  <button
                    onClick={() => setSelectedIndex(index)}
                    className="relative aspect-square w-full overflow-hidden rounded-md bg-stone-100 dark:bg-[#2a2a2d] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  
                  {/* Quick download button (visible on hover/touch) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadImage(image, index)
                    }}
                    className={cn(
                      "absolute bottom-1.5 right-1.5 p-2 rounded-full transition-all",
                      "bg-black/60 text-white",
                      "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                      "md:opacity-100 md:bg-black/40 md:hover:bg-black/60",
                      "active:scale-95",
                      downloadSuccess === image.id && "bg-green-500"
                    )}
                    disabled={downloadingId === image.id}
                  >
                    {downloadingId === image.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : downloadSuccess === image.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Fullscreen viewer */}
      {selectedImage && (
        <div 
          ref={imageContainerRef}
          className="fixed inset-0 z-[60] bg-black flex flex-col"
          onClick={handleImageTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar - fades in/out */}
          <div className={cn(
            "absolute top-0 left-0 right-0 z-10 transition-opacity duration-200 safe-area-top",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex items-center justify-between px-2 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-11 w-11 text-white hover:bg-white/20 active:bg-white/30"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(null)
                  }}
                >
                  <X className="h-6 w-6" />
                </Button>
                <div className="ml-1">
                  <p className="text-sm text-white font-medium">
                    {selectedImage.senderDisplayName || t('messages.unknownUser')}
                  </p>
                  <p className="text-xs text-white/70">
                    {formatDate(selectedImage.createdAt)}
                  </p>
                </div>
              </div>
              <span className="text-sm text-white/80 px-3 py-1 rounded-full bg-black/30">
                {selectedIndex !== null ? selectedIndex + 1 : 0} / {images.length}
              </span>
            </div>
          </div>
          
          {/* Image */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.caption || ''}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
          
          {/* Caption */}
          {selectedImage.caption && (
            <div className={cn(
              "absolute bottom-24 left-0 right-0 px-4 transition-opacity duration-200",
              showControls ? "opacity-100" : "opacity-0"
            )}>
              <p className="text-white text-center text-sm bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2 mx-auto max-w-md">
                {selectedImage.caption}
              </p>
            </div>
          )}
          
          {/* Bottom action bar - always visible for easy access */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200 safe-area-bottom",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-4 px-4">
              <div className="flex items-center justify-center gap-4">
                {/* Share button (if supported) */}
                {canShare && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      shareImage(selectedImage)
                    }}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Share2 className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs text-white/80">{t('common.share', { defaultValue: 'Share' })}</span>
                  </button>
                )}
                
                {/* Download button - prominent */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadImage(selectedImage, selectedIndex || 0)
                  }}
                  disabled={downloadingId === selectedImage.id}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl transition-colors",
                    "hover:bg-white/10 active:bg-white/20",
                    downloadSuccess === selectedImage.id && "bg-green-500/20"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                    downloadSuccess === selectedImage.id 
                      ? "bg-green-500" 
                      : "bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
                  )}>
                    {downloadingId === selectedImage.id ? (
                      <Loader2 className="h-7 w-7 text-white animate-spin" />
                    ) : downloadSuccess === selectedImage.id ? (
                      <Check className="h-7 w-7 text-white" />
                    ) : (
                      <Download className="h-7 w-7 text-white" />
                    )}
                  </div>
                  <span className="text-xs text-white/80">
                    {downloadSuccess === selectedImage.id 
                      ? t('common.saved', { defaultValue: 'Saved' })
                      : t('common.save', { defaultValue: 'Save' })
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Navigation arrows - larger touch targets for mobile */}
          {selectedIndex !== null && selectedIndex > 0 && (
            <button
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 p-4 transition-opacity duration-200",
                "text-white active:scale-95",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
            >
              <div className="p-2 rounded-full bg-black/40 hover:bg-black/60">
                <ChevronLeft className="h-8 w-8" />
              </div>
            </button>
          )}
          {selectedIndex !== null && selectedIndex < images.length - 1 && (
            <button
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 p-4 transition-opacity duration-200",
                "text-white active:scale-95",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
            >
              <div className="p-2 rounded-full bg-black/40 hover:bg-black/60">
                <ChevronRight className="h-8 w-8" />
              </div>
            </button>
          )}
          
          {/* Swipe hint for first-time users */}
          {selectedIndex === 0 && images.length > 1 && (
            <div className={cn(
              "absolute bottom-32 left-1/2 -translate-x-1/2 transition-opacity duration-500",
              showControls ? "opacity-60" : "opacity-0"
            )}>
              <p className="text-xs text-white/60 whitespace-nowrap">
                {t('messages.swipeHint', { defaultValue: 'Swipe to navigate' })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
