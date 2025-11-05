/**
 * Lazy Image Component with Intersection Observer
 * Only loads images when they enter the viewport
 */
import React, { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  style?: React.CSSProperties
  placeholder?: string
}

export const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  style,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3C/svg%3E'
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!src || imageSrc) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            // Start loading image
            const img = new Image()
            img.onload = () => {
              setImageSrc(src)
              setIsLoaded(true)
            }
            img.onerror = () => {
              // Keep placeholder on error
              setIsLoaded(true)
            }
            img.src = src
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [src, imageSrc])

  const displaySrc = imageSrc || (isInView ? null : placeholder)

  return (
    <div 
      ref={imgRef} 
      className={className}
      style={{
        ...style,
        backgroundImage: displaySrc ? `url(${displaySrc})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#f3f4f6',
        transition: isLoaded ? 'opacity 0.3s ease-in-out' : 'none',
        opacity: isLoaded && imageSrc ? 1 : 0.7
      }}
      aria-label={alt}
    />
  )
}

/**
 * Lazy Image as img element (for use with img tags)
 */
export const LazyImg: React.FC<LazyImageProps & { 
  draggable?: boolean
  decoding?: 'async' | 'auto' | 'sync'
}> = ({ 
  src, 
  alt, 
  className = '', 
  style,
  placeholder,
  draggable = false,
  decoding = 'async'
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!src || imageSrc) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image()
            img.onload = () => {
              setImageSrc(src)
              setIsLoaded(true)
            }
            img.onerror = () => {
              setIsLoaded(true)
            }
            img.src = src
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [src, imageSrc])

  if (!imageSrc && !isLoaded) {
    return (
      <img
        ref={imgRef}
        src={placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3C/svg%3E'}
        alt={alt}
        className={className}
        style={{ ...style, opacity: 0.7 }}
        draggable={draggable}
        decoding={decoding}
        loading="lazy"
      />
    )
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc || src || placeholder}
      alt={alt}
      className={className}
      style={{ ...style, opacity: isLoaded ? 1 : 0.7 }}
      draggable={draggable}
      decoding={decoding}
      loading="lazy"
    />
  )
}
