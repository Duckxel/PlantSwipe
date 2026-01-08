/**
 * CameraCapture Component
 * 
 * Allows users to take pictures using their device camera (phone/tablet) or webcam (desktop).
 * Uses the MediaDevices API for cross-platform camera access.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Camera, 
  X, 
  RotateCcw, 
  Check, 
  Loader2,
  SwitchCamera,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CameraCaptureProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  open,
  onOpenChange,
  onCapture
}) => {
  const { t } = useTranslation('common')
  
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  
  const [isInitializing, setIsInitializing] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null)
  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = React.useState(false)
  
  // Check for multiple cameras
  React.useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch {
        // Ignore errors, just assume single camera
      }
    }
    checkCameras()
  }, [])
  
  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])
  
  const startCamera = React.useCallback(async () => {
    setIsInitializing(true)
    setError(null)
    
    // Stop any existing stream
    stopCamera()
    
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('camera_not_supported')
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      
      setIsInitializing(false)
    } catch (err: unknown) {
      console.error('[CameraCapture] Failed to start camera:', err)
      
      const error = err as { name?: string; message?: string }
      let errorMessage: string
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = t('messages.camera.permissionDenied', { 
          defaultValue: 'Camera access denied. Please allow camera access in your browser settings.'
        })
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = t('messages.camera.notFound', { 
          defaultValue: 'No camera found on this device.'
        })
      } else if (error.message === 'camera_not_supported') {
        errorMessage = t('messages.camera.notSupported', { 
          defaultValue: 'Camera is not supported in this browser. Please try a different browser.'
        })
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = t('messages.camera.inUse', { 
          defaultValue: 'Camera is being used by another application.'
        })
      } else {
        errorMessage = t('messages.camera.error', { 
          defaultValue: 'Failed to access camera. Please try again.'
        })
      }
      
      setError(errorMessage)
      setIsInitializing(false)
    }
  }, [facingMode, stopCamera, t])
  
  // Start camera when dialog opens
  React.useEffect(() => {
    if (!open) {
      stopCamera()
      setCapturedImage(null)
      setError(null)
      setIsInitializing(true)
      return
    }
    
    startCamera()
    
    return () => {
      stopCamera()
    }
  }, [open, facingMode, startCamera, stopCamera])
  
  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas) return
    
    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Mirror the image if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Get image data URL for preview
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageDataUrl)
    
    // Stop camera while reviewing
    stopCamera()
  }
  
  const handleRetake = () => {
    setCapturedImage(null)
    startCamera()
  }
  
  const handleConfirm = async () => {
    if (!capturedImage || !canvasRef.current) return
    
    // Convert canvas to blob
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
          onOpenChange(false)
        }
      },
      'image/jpeg',
      0.9
    )
  }
  
  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
    setCapturedImage(null)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] p-0 overflow-hidden bg-black"
        aria-describedby="camera-capture-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {t('messages.camera.title', { defaultValue: 'Take Photo' })}
          </DialogTitle>
          <DialogDescription id="camera-capture-description">
            {t('messages.camera.description', { defaultValue: 'Use your camera to take a photo' })}
          </DialogDescription>
        </DialogHeader>
        
        {/* Camera view */}
        <div className="relative aspect-[3/4] sm:aspect-video bg-black">
          {/* Video preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              facingMode === 'user' && "scale-x-[-1]",
              capturedImage && "hidden"
            )}
          />
          
          {/* Captured image preview */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt={t('messages.camera.capturedPhoto', { defaultValue: 'Captured photo' })}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Loading state */}
          {isInitializing && !error && !capturedImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
              <Loader2 className="h-10 w-10 animate-spin text-white mb-4" />
              <p className="text-white text-sm">
                {t('messages.camera.initializing', { defaultValue: 'Starting camera...' })}
              </p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="text-white text-sm mb-4 max-w-xs">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('messages.camera.retry', { defaultValue: 'Try Again' })}
              </Button>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="p-4 bg-black">
          {capturedImage ? (
            /* Review controls */
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleRetake}
                className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <RotateCcw className="h-6 w-6" />
              </Button>
              <Button
                size="lg"
                onClick={handleConfirm}
                className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white"
              >
                <Check className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          ) : (
            /* Capture controls */
            <div className="flex items-center justify-center gap-6">
              {/* Empty space for balance */}
              <div className="w-14 h-14" />
              
              {/* Capture button */}
              <Button
                size="lg"
                onClick={handleCapture}
                disabled={isInitializing || !!error}
                className="h-16 w-16 rounded-full bg-white hover:bg-white/90 text-black disabled:opacity-50"
              >
                <Camera className="h-8 w-8" />
              </Button>
              
              {/* Switch camera button */}
              {hasMultipleCameras ? (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleSwitchCamera}
                  disabled={isInitializing || !!error}
                  className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                >
                  <SwitchCamera className="h-6 w-6" />
                </Button>
              ) : (
                <div className="w-14 h-14" />
              )}
            </div>
          )}
          
          {/* Hint text */}
          {!capturedImage && !error && !isInitializing && (
            <p className="text-center text-white/60 text-xs mt-3">
              {t('messages.camera.hint', { defaultValue: 'Tap the button to take a photo' })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CameraCapture
