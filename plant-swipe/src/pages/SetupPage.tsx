import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate, useLanguage } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SearchInput } from "@/components/ui/search-input"
import { ChevronLeft, Bell, Flower2, Trees, Sparkles, Clock, Sprout, Palette, MapPin, Check, Loader2, X } from "lucide-react"
import { ACCENT_OPTIONS, applyAccentByKey, getAccentHex, type AccentKey } from "@/lib/accent"
import { useDebounce } from "@/hooks/useDebounce"

type SetupStep = 'welcome' | 'accent' | 'location' | 'garden_type' | 'experience' | 'purpose' | 'notification_time' | 'notifications' | 'complete'

type GardenType = 'inside' | 'outside' | 'both'
type ExperienceLevel = 'novice' | 'intermediate' | 'expert'
type LookingFor = 'eat' | 'ornamental' | 'various'
type NotificationTime = '6h' | '10h' | '14h' | '17h'

interface SetupData {
  accent_key: AccentKey
  country: string
  city: string
  timezone: string
  garden_type: GardenType | null
  experience_level: ExperienceLevel | null
  looking_for: LookingFor | null
  notification_time: NotificationTime | null
}

// Location suggestion from geocoding API
interface LocationSuggestion {
  id: number
  name: string
  country: string
  admin1?: string // State/Province
  latitude: number
  longitude: number
  timezone?: string
}

const STEPS: SetupStep[] = ['welcome', 'accent', 'location', 'garden_type', 'experience', 'purpose', 'notification_time', 'notifications', 'complete']

// Liana/Vine Progress Bar Component with leaves and flowers
const LianaProgressBar: React.FC<{ progress: number; accentColor?: string }> = ({ progress, accentColor }) => {
  // Track the animated progress value for syncing leaves
  const [animatedProgress, setAnimatedProgress] = React.useState(0)
  const animationDuration = 0.5 // seconds
  
  // Animate progress changes smoothly
  React.useEffect(() => {
    const startProgress = animatedProgress
    const targetProgress = progress
    const startTime = performance.now()
    
    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000
      const t = Math.min(elapsed / animationDuration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const currentProgress = startProgress + (targetProgress - startProgress) * eased
      
      setAnimatedProgress(currentProgress)
      
      if (t < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [progress])
  
  // Leaf positions - alternating above and below the vine at wave peaks/troughs
  // x positions: peaks at 5,15,25,35,45,55,65,75,85,95 | troughs at 10,20,30,40,50,60,70,80,90
  const leafPositions = [
    // Above the vine (at peaks, y=6) - pointing upward and outward
    { x: 5, y: 6, rotation: -30 },
    { x: 15, y: 6, rotation: -50 },
    { x: 35, y: 6, rotation: -35 },
    { x: 45, y: 6, rotation: -55 },
    { x: 65, y: 6, rotation: -40 },
    { x: 75, y: 6, rotation: -50 },
    { x: 95, y: 6, rotation: -45 },
    // Below the vine (at troughs, y=10) - pointing downward and outward  
    { x: 10, y: 10, rotation: 130 },
    { x: 20, y: 10, rotation: 150 },
    { x: 40, y: 10, rotation: 135 },
    { x: 50, y: 10, rotation: 145 },
    { x: 70, y: 10, rotation: 130 },
    { x: 80, y: 10, rotation: 150 },
    { x: 90, y: 10, rotation: 140 },
  ]
  
  // Flower positions - placed at specific peaks
  const flowerPositions = [
    { x: 25, y: 6, size: 11 },
    { x: 55, y: 6, size: 12 },
    { x: 88, y: 6, size: 11 },
  ]

  // Use a unique ID for clip paths to avoid conflicts if multiple instances
  const clipId = React.useId()
  
  // Gap between filled vine and remaining line
  const gapSize = 3
  
  // Calculate Y position on the wave for a given X
  const getWaveY = (x: number): number => {
    // Wave oscillates between 6 and 10 with period of 10
    const phase = (x % 10) / 10
    if (phase < 0.5) {
      // Going from 8 to peak (6) to 8
      return 8 - 2 * Math.sin(phase * 2 * Math.PI)
    } else {
      // Going from 8 to trough (10) to 8
      return 8 - 2 * Math.sin(phase * 2 * Math.PI)
    }
  }

  return (
    <div className="flex-1 h-8 relative">
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 100 16" 
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Clip for the vine - uses animated progress, starts at 0 when progress is 0 */}
          <clipPath id={`vineClip-${clipId}`}>
            <rect
              x="0"
              y="-5"
              height="30"
              width={Math.max(0, animatedProgress)}
            />
          </clipPath>
          {/* Clip for the remaining line - with gap */}
          <clipPath id={`lineClip-${clipId}`}>
            <rect
              x={Math.max(0, animatedProgress + gapSize)}
              y="-5"
              height="30"
              width={Math.max(0, 102 - animatedProgress - gapSize)}
            />
          </clipPath>
        </defs>
        
        {/* Background line - dark on light theme, light on dark theme */}
        <g clipPath={`url(#lineClip-${clipId})`}>
          <line
            x1="0"
            y1="8"
            x2="100"
            y2="8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-stone-400 dark:text-stone-500"
          />
        </g>
        
        {/* Growing vine - accent color, high frequency wave */}
        {animatedProgress > 0 && (
          <g clipPath={`url(#vineClip-${clipId})`}>
            {/* Main vine stem - much higher frequency (20 half-waves), rounded ends, accent color */}
            <path
              d="M 0 8 
                 C 2.5 8, 2.5 6, 5 6
                 C 7.5 6, 7.5 10, 10 10
                 C 12.5 10, 12.5 6, 15 6
                 C 17.5 6, 17.5 10, 20 10
                 C 22.5 10, 22.5 6, 25 6
                 C 27.5 6, 27.5 10, 30 10
                 C 32.5 10, 32.5 6, 35 6
                 C 37.5 6, 37.5 10, 40 10
                 C 42.5 10, 42.5 6, 45 6
                 C 47.5 6, 47.5 10, 50 10
                 C 52.5 10, 52.5 6, 55 6
                 C 57.5 6, 57.5 10, 60 10
                 C 62.5 10, 62.5 6, 65 6
                 C 67.5 6, 67.5 10, 70 10
                 C 72.5 10, 72.5 6, 75 6
                 C 77.5 6, 77.5 10, 80 10
                 C 82.5 10, 82.5 6, 85 6
                 C 87.5 6, 87.5 10, 90 10
                 C 92.5 10, 92.5 6, 95 6
                 C 97.5 6, 97.5 8, 100 8"
              fill="none"
              stroke={accentColor || 'currentColor'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
        
        {/* Rounded end cap at the vine tip */}
        {animatedProgress > 1 && animatedProgress < 99 && (
          <circle 
            cx={animatedProgress} 
            cy={getWaveY(animatedProgress)}
            r="1.25"
            fill={accentColor || 'currentColor'}
          />
        )}
      </svg>
      
      {/* Animated leaves - clean simple leaves */}
      {leafPositions.map((leaf, index) => {
        const shouldShow = animatedProgress >= leaf.x
        const isAbove = leaf.y === 6
        // Position: y=6 is 37.5% from top, y=10 is 62.5% from top
        const topPercent = (leaf.y / 16) * 100
        
        return (
          <motion.div
            key={index}
            className="absolute pointer-events-none"
            style={{
              left: `${leaf.x}%`,
              top: `${topPercent}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: shouldShow ? 1 : 0, 
              opacity: shouldShow ? 1 : 0,
            }}
            transition={{ 
              duration: 0.25, 
              type: "spring",
              stiffness: 500,
              damping: 20
            }}
          >
            <svg 
              width="10" 
              height="12" 
              viewBox="0 0 10 12"
              style={{
                transform: `translate(-50%, ${isAbove ? '-100%' : '0%'}) rotate(${leaf.rotation}deg)`,
                transformOrigin: isAbove ? 'center bottom' : 'center top',
                overflow: 'visible',
              }}
            >
              {/* Simple leaf shape */}
              <path
                d="M 5 0 Q 9 3, 5 12 Q 1 3, 5 0"
                fill={accentColor || 'currentColor'}
              />
            </svg>
          </motion.div>
        )
      })}
      
      {/* Animated flowers - petals: white on dark, dark on light; center: yellow */}
      <div className="absolute inset-0" style={{ overflow: 'visible' }}>
        {flowerPositions.map((flower, index) => {
          const shouldShow = animatedProgress >= flower.x + 4
          const yOffset = ((flower.y - 8) / 16) * 32
          
          return (
            <motion.div
              key={`flower-${index}`}
              className="absolute"
              style={{
                left: `${flower.x}%`,
                top: '50%',
              }}
              initial={{ scale: 0, opacity: 0, rotate: -30 }}
              animate={{ 
                scale: shouldShow ? 1 : 0, 
                opacity: shouldShow ? 1 : 0,
                rotate: shouldShow ? 0 : -30,
              }}
              transition={{ 
                duration: 0.4, 
                type: "spring",
                stiffness: 300,
                damping: 12,
                delay: 0.1
              }}
            >
              <svg 
                width={flower.size} 
                height={flower.size} 
                viewBox="0 0 24 24"
                className="drop-shadow-md"
                style={{
                  transform: `translateY(${yOffset - flower.size}px) translateX(-50%)`,
                }}
              >
                {/* 5-petal flower - white on dark theme, dark on light theme */}
                <g className="fill-stone-700 dark:fill-white">
                  <ellipse cx="12" cy="5" rx="3.5" ry="4.5" />
                  <ellipse cx="12" cy="5" rx="3.5" ry="4.5" transform="rotate(72 12 12)" />
                  <ellipse cx="12" cy="5" rx="3.5" ry="4.5" transform="rotate(144 12 12)" />
                  <ellipse cx="12" cy="5" rx="3.5" ry="4.5" transform="rotate(216 12 12)" />
                  <ellipse cx="12" cy="5" rx="3.5" ry="4.5" transform="rotate(288 12 12)" />
                </g>
                {/* Center of flower - accent color */}
                <circle cx="12" cy="12" r="3" fill={accentColor || '#FCD34D'} />
                <circle cx="12" cy="12" r="1.5" fill={accentColor || '#F59E0B'} style={{ filter: 'brightness(0.7)' }} />
              </svg>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export function SetupPage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const currentLang = useLanguage()
  const { user, profile, refreshProfile } = useAuth()
  
  const [currentStep, setCurrentStep] = React.useState<SetupStep>('welcome')
  const [setupData, setSetupData] = React.useState<SetupData>({
    accent_key: 'emerald',
    country: '',
    city: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    garden_type: null,
    experience_level: null,
    looking_for: null,
    notification_time: '10h',
  })
  const [saving, setSaving] = React.useState(false)
  const [direction, setDirection] = React.useState<1 | -1>(1)
  const [locationLoading, setLocationLoading] = React.useState(true) // Start as loading
  const [locationDetected, setLocationDetected] = React.useState(false)
  
  // Location search state
  const [locationSearch, setLocationSearch] = React.useState('')
  const debouncedLocationSearch = useDebounce(locationSearch, 350) // Debounce search input
  const [locationSuggestions, setLocationSuggestions] = React.useState<LocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [searchingLocation, setSearchingLocation] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false) // Track if we've searched at least once
  const [detectingGPS, setDetectingGPS] = React.useState(false)
  const suggestionsRef = React.useRef<HTMLDivElement>(null)
  const locationDetectionAttempted = React.useRef(false)

  // Auto-detect location and timezone on component mount (runs only once)
  // Note: We DON'T auto-change language here - respect the URL language choice
  React.useEffect(() => {
    // Only run once - use ref to prevent multiple attempts
    if (locationDetectionAttempted.current || locationDetected) {
      setLocationLoading(false)
      return
    }
    locationDetectionAttempted.current = true
    
    const detectLocation = async () => {
      setLocationLoading(true)
      try {
        // Use ipapi.co for free HTTPS IP geolocation (includes timezone)
        // Free tier: 1000 requests/day, no API key required
        const response = await fetch('https://ipapi.co/json/')
        if (response.ok) {
          const data = await response.json()
          if (!data.error) {
            // Update location data
            setSetupData(prev => ({
              ...prev,
              country: data.country_name || prev.country || '',
              city: data.city || prev.city || '',
              timezone: data.timezone || prev.timezone || 'UTC',
            }))
            
            setLocationDetected(true)
            console.log('[setup] Location detected:', data.country_name, data.city, 'Timezone:', data.timezone)
          }
        }
      } catch (err) {
        console.warn('[setup] Failed to detect location:', err)
      } finally {
        setLocationLoading(false)
      }
    }
    
    detectLocation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount

  // Redirect if no user or already completed setup
  React.useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (profile?.setup_completed) {
      // If setup is complete but email not verified, redirect to email verification
      // SECURITY: Use !== true to catch both false AND null/undefined values
      if (profile?.email_verified !== true) {
        navigate('/verify-email')
      } else {
        navigate('/discovery')
      }
    }
  }, [user, profile?.setup_completed, profile?.email_verified, navigate])

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search for location suggestions when debounced query changes
  React.useEffect(() => {
    if (debouncedLocationSearch.length < 2) {
      setLocationSuggestions([])
      setHasSearched(false)
      return
    }

    let cancelled = false
    
    const searchLocations = async () => {
      setSearchingLocation(true)
      try {
        const resp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(debouncedLocationSearch)}&count=8&language=${currentLang}&format=json`
        )
        if (cancelled) return
        
        if (resp.ok) {
          const data = await resp.json()
          if (cancelled) return
          
          if (data.results && Array.isArray(data.results)) {
            setLocationSuggestions(
              data.results.map((r: any) => ({
                id: r.id,
                name: r.name,
                country: r.country || '',
                admin1: r.admin1 || '',
                latitude: r.latitude,
                longitude: r.longitude,
                timezone: r.timezone,
              }))
            )
          } else {
            setLocationSuggestions([])
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[setup] Location search failed:', err)
          setLocationSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setSearchingLocation(false)
          setHasSearched(true)
        }
      }
    }

    searchLocations()
    
    return () => {
      cancelled = true
    }
  }, [debouncedLocationSearch, currentLang])

  // Handle location search input change - just update the state, debounce handles the rest
  const handleLocationSearchChange = (value: string) => {
    setLocationSearch(value)
    setShowSuggestions(true)
    // Reset hasSearched when user types to prevent showing "no results" during typing
    if (value !== debouncedLocationSearch) {
      setHasSearched(false)
    }
  }

  // Handle selecting a location suggestion
  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    setSetupData(prev => ({
      ...prev,
      city: suggestion.name,
      country: suggestion.country,
      timezone: suggestion.timezone || prev.timezone,
    }))
    setLocationSearch('')
    setLocationSuggestions([])
    setShowSuggestions(false)
    setLocationDetected(true)
  }

  // Clear selected location
  const handleClearLocation = () => {
    setSetupData(prev => ({
      ...prev,
      city: '',
      country: '',
    }))
    setLocationDetected(false)
  }

  // Detect location using browser geolocation
  const detectLocationGPS = async () => {
    if (!navigator.geolocation) {
      alert(t('setup.location.geoNotSupported', 'Geolocation is not supported by your browser'))
      return
    }

    setDetectingGPS(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          
          // Use Nominatim for reverse geocoding
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept': 'application/json' } }
          )
          
          if (resp.ok) {
            const data = await resp.json()
            const detectedCity = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || ''
            const detectedCountry = data.address?.country || ''
            
            if (detectedCity || detectedCountry) {
              setSetupData(prev => ({
                ...prev,
                city: detectedCity,
                country: detectedCountry,
              }))
              setLocationDetected(true)
            }
          }
        } catch (err) {
          console.error('[setup] Reverse geocoding failed:', err)
          alert(t('setup.location.detectFailed', 'Unable to detect location. Please search manually.'))
        } finally {
          setDetectingGPS(false)
        }
      },
      (error) => {
        console.error('[setup] Geolocation error:', error)
        setDetectingGPS(false)
        alert(t('setup.location.detectFailed', 'Unable to detect location. Please search manually.'))
      },
      { timeout: 10000 }
    )
  }

  const currentStepIndex = STEPS.indexOf(currentStep)
  const progress = ((currentStepIndex) / (STEPS.length - 1)) * 100

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setDirection(1)
      setCurrentStep(STEPS[nextIndex])
    }
  }

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setDirection(-1)
      setCurrentStep(STEPS[prevIndex])
    }
  }

  const handleAccentSelect = (key: AccentKey) => {
    setSetupData(prev => ({ ...prev, accent_key: key }))
    applyAccentByKey(key)
  }

  const handleGardenTypeSelect = (type: GardenType) => {
    setSetupData(prev => ({ ...prev, garden_type: type }))
  }

  const handleExperienceSelect = (level: ExperienceLevel) => {
    setSetupData(prev => ({ ...prev, experience_level: level }))
  }

  const handlePurposeSelect = (purpose: LookingFor) => {
    setSetupData(prev => ({ ...prev, looking_for: purpose }))
  }

  const handleNotificationTimeSelect = (time: NotificationTime) => {
    setSetupData(prev => ({ ...prev, notification_time: time }))
  }

  const requestNotificationPermission = async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission()
        console.log('[setup] Notification permission:', permission)
      }
    } catch (err) {
      console.warn('[setup] Failed to request notification permission:', err)
    }
    goToNextStep()
  }

  const completeSetup = async () => {
    if (!user?.id) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          setup_completed: true,
          accent_key: setupData.accent_key,
          country: setupData.country || null,
          city: setupData.city || null,
          timezone: setupData.timezone || null,
          garden_type: setupData.garden_type,
          experience_level: setupData.experience_level,
          looking_for: setupData.looking_for,
          notification_time: setupData.notification_time,
        })
        .eq('id', user.id)

      if (error) {
        console.error('[setup] Failed to save setup:', error)
        return
      }

      await refreshProfile()
      // Redirect to email verification as the final step
      navigate('/verify-email')
    } catch (err) {
      console.error('[setup] Error completing setup:', err)
    } finally {
      setSaving(false)
    }
  }

  // Check if current step has a valid selection for continue button
  const canContinue = () => {
    switch (currentStep) {
      case 'accent':
        return true // Always has default
      case 'location':
        return setupData.country.trim().length > 0 // Country is required
      case 'garden_type':
        return setupData.garden_type !== null
      case 'experience':
        return setupData.experience_level !== null
      case 'purpose':
        return setupData.looking_for !== null
      case 'notification_time':
        return setupData.notification_time !== null
      default:
        return true
    }
  }

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  }

  // Pill option component - Brilliant style
  const PillOption: React.FC<{
    selected: boolean
    onClick: () => void
    label: string
    index: number
  }> = ({ selected, onClick, label, index }) => (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onClick}
      className={`w-full px-6 py-4 rounded-2xl text-base font-medium transition-all duration-200 text-center ${
        selected 
          ? 'bg-accent text-accent-foreground shadow-lg' 
          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
      }`}
    >
      {label}
    </motion.button>
  )

  // Question header with icon
  const QuestionHeader: React.FC<{
    icon: React.ReactNode
    question: string
  }> = ({ icon, question }) => (
    <div className="flex items-center gap-4 mb-10">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
        {icon}
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100">
        {question}
      </h2>
    </div>
  )

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <motion.div
            key="welcome"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center max-w-md mx-auto"
          >
            {/* Animated logo with glow effect */}
            <motion.div 
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative mb-8"
            >
              {/* Glow background */}
              <div className="absolute inset-0 bg-accent/30 rounded-full blur-2xl scale-150" />
              {/* Logo container */}
              <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 dark:from-accent/30 dark:to-accent/10 flex items-center justify-center shadow-2xl border border-accent/20">
                <img 
                  src="/icons/plant-swipe-icon.svg" 
                  alt="Aphylia"
                  className="w-20 h-20 plant-icon-theme"
                  draggable="false"
                />
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4"
            >
              {t('setup.welcome.title', 'Welcome to Aphylia!')}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-stone-600 dark:text-stone-300 text-base md:text-lg mb-6 leading-relaxed"
            >
              {t('setup.welcome.description', "I'm your garden assistant. I will accompany you through this journey to make your garden grow and bloom into the most beautiful one!")}
            </motion.p>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-stone-500 dark:text-stone-400 text-sm mb-8"
            >
              {t('setup.welcome.subtitle', "First, let's get to know each other and the environment where your garden will evolve.")}
            </motion.p>
          </motion.div>
        )

      case 'accent':
        return (
          <motion.div
            key="accent"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Palette className="w-6 h-6 text-white" />}
              question={t('setup.accent.title', 'Choose your accent color')}
            />

            <div className="grid grid-cols-4 gap-3 mb-6">
              {ACCENT_OPTIONS.map((accent, index) => (
                <motion.button
                  key={accent.key}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleAccentSelect(accent.key)}
                  className={`relative aspect-square rounded-2xl transition-all duration-200 ${
                    setupData.accent_key === accent.key 
                      ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-stone-900 ring-stone-400 dark:ring-stone-500 scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: `hsl(${accent.hsl})` }}
                  title={accent.label}
                />
              ))}
            </div>

            <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
              {t('setup.accent.selected', 'Selected')}: <span className="font-medium text-stone-700 dark:text-stone-200">{ACCENT_OPTIONS.find(a => a.key === setupData.accent_key)?.label}</span>
            </p>
          </motion.div>
        )

      case 'location':
        return (
          <motion.div
            key="location"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<MapPin className="w-6 h-6 text-white" />}
              question={t('setup.location.title', 'Where are you located?')}
            />

            <div className="space-y-5">
              {/* Auto-detecting indicator */}
              {!locationDetected && locationLoading && (
                <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-4 py-3 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('setup.location.detecting', 'Detecting your location...')}
                </div>
              )}

              {/* Selected location display */}
              {setupData.city && setupData.country ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-accent bg-accent/10"
                >
                  <MapPin className="w-6 h-6 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-800 dark:text-stone-100 truncate">
                      {setupData.city}
                    </div>
                    <div className="text-sm text-stone-600 dark:text-stone-400 truncate">
                      {setupData.country}
                    </div>
                    {setupData.timezone && (
                      <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-500 mt-1">
                        <Clock className="w-3 h-3" />
                        {setupData.timezone}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="p-2 rounded-full hover:bg-accent/20 transition-colors"
                  >
                    <X className="w-5 h-5 text-accent" />
                  </button>
                </motion.div>
              ) : (
                /* Search input with suggestions */
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                    {t('setup.location.searchLabel', 'Search for your city')}
                  </Label>
                  <div className="relative" ref={suggestionsRef}>
                    <SearchInput
                      variant="lg"
                      value={locationSearch}
                      onChange={(e) => handleLocationSearchChange(e.target.value)}
                      onFocus={() => locationSearch.length >= 2 && setShowSuggestions(true)}
                      onClear={locationSearch ? () => {
                        setLocationSearch('')
                        setLocationSuggestions([])
                        setShowSuggestions(false)
                      } : undefined}
                      placeholder={t('setup.location.searchPlaceholder', 'Type a city name...')}
                      loading={searchingLocation}
                      className="bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                    />
                    
                    {/* Suggestions dropdown */}
                    {showSuggestions && locationSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl overflow-hidden">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-left"
                            onClick={() => handleSelectLocation(suggestion)}
                          >
                            <MapPin className="w-5 h-5 text-stone-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-stone-800 dark:text-stone-100 truncate">
                                {suggestion.name}
                              </div>
                              <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
                                {suggestion.admin1 ? `${suggestion.admin1}, ` : ''}{suggestion.country}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* No results - only show after search completes with no results */}
                    {showSuggestions && hasSearched && !searchingLocation && locationSuggestions.length === 0 && debouncedLocationSearch.length >= 2 && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl p-4 text-center text-sm text-stone-500">
                        {t('setup.location.noResults', 'No cities found. Try a different search.')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detect Location Button */}
              {!setupData.city && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={detectLocationGPS}
                    disabled={detectingGPS}
                    className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all disabled:opacity-50"
                  >
                    {detectingGPS ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('setup.location.detectingGPS', 'Detecting...')}
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        {t('setup.location.detectButton', 'Use my current location')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )

      case 'garden_type':
        return (
          <motion.div
            key="garden_type"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Trees className="w-6 h-6 text-white" />}
              question={t('setup.gardenType.title', 'Where is your garden located?')}
            />

            <div className="flex flex-col gap-3">
              <PillOption
                selected={setupData.garden_type === 'outside'}
                onClick={() => handleGardenTypeSelect('outside')}
                label={t('setup.gardenType.outside', 'Outside, in a yard')}
                index={0}
              />
              <PillOption
                selected={setupData.garden_type === 'inside'}
                onClick={() => handleGardenTypeSelect('inside')}
                label={t('setup.gardenType.inside', 'Inside your home')}
                index={1}
              />
              <PillOption
                selected={setupData.garden_type === 'both'}
                onClick={() => handleGardenTypeSelect('both')}
                label={t('setup.gardenType.both', 'Both inside and outside')}
                index={2}
              />
            </div>
          </motion.div>
        )

      case 'experience':
        return (
          <motion.div
            key="experience"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Sprout className="w-6 h-6 text-white" />}
              question={t('setup.experience.title', "What's your gardening level?")}
            />

            <div className="flex flex-col gap-3">
              <PillOption
                selected={setupData.experience_level === 'novice'}
                onClick={() => handleExperienceSelect('novice')}
                label={t('setup.experience.novice', 'Novice')}
                index={0}
              />
              <PillOption
                selected={setupData.experience_level === 'intermediate'}
                onClick={() => handleExperienceSelect('intermediate')}
                label={t('setup.experience.intermediate', 'Intermediate')}
                index={1}
              />
              <PillOption
                selected={setupData.experience_level === 'expert'}
                onClick={() => handleExperienceSelect('expert')}
                label={t('setup.experience.expert', 'Expert')}
                index={2}
              />
            </div>
          </motion.div>
        )

      case 'purpose':
        return (
          <motion.div
            key="purpose"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Flower2 className="w-6 h-6 text-white" />}
              question={t('setup.purpose.title', 'What is your purpose for your garden?')}
            />

            <div className="flex flex-col gap-3">
              <PillOption
                selected={setupData.looking_for === 'eat'}
                onClick={() => handlePurposeSelect('eat')}
                label={t('setup.purpose.eat', 'Grow vegetables and fruits')}
                index={0}
              />
              <PillOption
                selected={setupData.looking_for === 'ornamental'}
                onClick={() => handlePurposeSelect('ornamental')}
                label={t('setup.purpose.ornamental', 'Have an ornamental flower garden')}
                index={1}
              />
              <PillOption
                selected={setupData.looking_for === 'various'}
                onClick={() => handlePurposeSelect('various')}
                label={t('setup.purpose.various', 'Have as many various plants as possible!')}
                index={2}
              />
            </div>
          </motion.div>
        )

      case 'notification_time':
        return (
          <motion.div
            key="notification_time"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Clock className="w-6 h-6 text-white" />}
              question={t('setup.notificationTime.title', 'When should we remind you?')}
            />

            <div className="flex flex-col gap-3">
              <PillOption
                selected={setupData.notification_time === '6h'}
                onClick={() => handleNotificationTimeSelect('6h')}
                label={t('setup.notificationTime.early', 'Early bird')}
                index={0}
              />
              <PillOption
                selected={setupData.notification_time === '10h'}
                onClick={() => handleNotificationTimeSelect('10h')}
                label={t('setup.notificationTime.morning', 'Sleep in')}
                index={1}
              />
              <PillOption
                selected={setupData.notification_time === '14h'}
                onClick={() => handleNotificationTimeSelect('14h')}
                label={t('setup.notificationTime.midday', 'Midday energy')}
                index={2}
              />
              <PillOption
                selected={setupData.notification_time === '17h'}
                onClick={() => handleNotificationTimeSelect('17h')}
                label={t('setup.notificationTime.afternoon', 'After work')}
                index={3}
              />
            </div>
          </motion.div>
        )

      case 'notifications':
        return (
          <motion.div
            key="notifications"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="max-w-md mx-auto"
          >
            <QuestionHeader 
              icon={<Bell className="w-6 h-6 text-white" />}
              question={t('setup.notifications.title', 'Stay on top of your garden')}
            />

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-stone-500 dark:text-stone-400 mb-8 -mt-4"
            >
              {t('setup.notifications.description', "Enable notifications to get reminders about watering, fertilizing, and caring for your plants at the perfect time.")}
            </motion.p>

            <div className="flex flex-col gap-3">
              <PillOption
                selected={false}
                onClick={requestNotificationPermission}
                label={t('setup.notifications.enable', 'Enable notifications')}
                index={0}
              />
              <PillOption
                selected={false}
                onClick={goToNextStep}
                label={t('setup.notifications.skip', 'Maybe later')}
                index={1}
              />
            </div>
          </motion.div>
        )

      case 'complete':
        return (
          <motion.div
            key="complete"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center max-w-md mx-auto"
          >
            {/* Celebratory logo with sparkles */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative mb-8"
            >
              {/* Animated sparkles around the logo */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-6 h-6 text-accent" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute -bottom-1 -left-2"
              >
                <Sparkles className="w-5 h-5 text-accent/70" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute top-1/2 -right-4"
              >
                <Sparkles className="w-4 h-4 text-accent/50" />
              </motion.div>
              
              {/* Glow background */}
              <div className="absolute inset-0 bg-accent/40 rounded-full blur-2xl scale-150" />
              
              {/* Logo with checkmark badge */}
              <div className="relative w-28 h-28 rounded-3xl bg-accent flex items-center justify-center shadow-2xl">
                <img 
                  src="/icons/plant-swipe-icon.svg" 
                  alt="Aphylia"
                  className="w-16 h-16 brightness-0 invert"
                  draggable="false"
                />
                {/* Success checkmark badge */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white dark:bg-stone-800 shadow-lg flex items-center justify-center border-2 border-accent">
                  <Check className="w-6 h-6 text-accent" />
                </div>
              </div>
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4"
            >
              {t('setup.complete.title', "You're all set!")}
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-stone-500 dark:text-stone-400 text-base md:text-lg mb-8"
            >
              {t('setup.complete.description', "Your garden assistant is ready to help you grow the most beautiful plants. Let's start exploring!")}
            </motion.p>
          </motion.div>
        )

      default:
        return null
    }
  }

  // Don't render anything while checking auth
  if (!user) return null

  const showContinueButton = currentStep !== 'notifications'
  const isCompleteStep = currentStep === 'complete'
  const isWelcomeStep = currentStep === 'welcome'

  return (
    <>
      {/* Logo theme styles */}
      <style>{`
        .plant-icon-theme {
          filter: brightness(0) saturate(100%);
        }
        .dark .plant-icon-theme {
          filter: brightness(0) saturate(100%) invert(100%);
        }
      `}</style>
      
      <div className="min-h-screen bg-white dark:bg-stone-900 flex flex-col">
        {/* Header with logo, progress bar and back button */}
        <div className="sticky top-0 z-50 bg-white dark:bg-stone-900">
          <div className="flex items-center gap-4 px-4 py-4 max-w-2xl mx-auto">
            {/* Back button */}
            {!isWelcomeStep && !isCompleteStep && (
              <button
                onClick={goToPreviousStep}
                className="p-2 -ml-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {(isWelcomeStep || isCompleteStep) && <div className="w-10" />}
            
            {/* Liana Progress Bar */}
            <LianaProgressBar progress={progress} accentColor={getAccentHex(setupData.accent_key)} />
            
            {/* Logo icon - flipped to face the progress bar */}
            <div className="w-10 flex items-center justify-center">
              <img 
                src="/icons/plant-swipe-icon.svg" 
                alt="Aphylia"
                className="w-8 h-8 plant-icon-theme opacity-60"
                style={{ transform: 'scaleX(-1)' }}
                draggable="false"
              />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <AnimatePresence mode="wait" custom={direction}>
            {renderStepContent()}
          </AnimatePresence>
        </div>

        {/* Continue button */}
        {showContinueButton && (
          <div className="sticky bottom-0 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 p-4">
            <div className="max-w-md mx-auto">
              <Button 
                onClick={isCompleteStep ? completeSetup : goToNextStep}
                disabled={!canContinue() || saving}
                size="lg"
                className={`w-full rounded-full py-6 text-base font-semibold transition-all duration-200 ${
                  canContinue() 
                    ? 'bg-accent hover:opacity-90 text-accent-foreground shadow-lg' 
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed'
                }`}
              >
                {saving 
                  ? t('common.saving', 'Saving...') 
                  : isCompleteStep 
                    ? t('setup.complete.button', 'Start exploring')
                    : t('common.continue', 'Continue')
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default SetupPage
