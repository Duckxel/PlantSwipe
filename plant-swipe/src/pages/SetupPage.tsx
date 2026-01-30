import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate, useChangeLanguage, useLanguage } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import i18n from "@/lib/i18n"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Bell, Flower2, Trees, Sparkles, Clock, Sprout, Palette, MapPin, Check } from "lucide-react"
import { ACCENT_OPTIONS, applyAccentByKey, type AccentKey } from "@/lib/accent"

// Country code to language mapping
const COUNTRY_TO_LANGUAGE: Record<string, 'en' | 'fr'> = {
  'FR': 'fr', // France
  'BE': 'fr', // Belgium (French-speaking regions)
  'CH': 'fr', // Switzerland (French-speaking regions)
  'CA': 'fr', // Canada (Quebec)
  'LU': 'fr', // Luxembourg
  'MC': 'fr', // Monaco
  // All others default to English
}

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

const STEPS: SetupStep[] = ['welcome', 'accent', 'location', 'garden_type', 'experience', 'purpose', 'notification_time', 'notifications', 'complete']

// Liana/Vine Progress Bar Component
const LianaProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  // Leaf positions along the vine - positioned at wave peaks/troughs for better connection
  const leafPositions = [
    { x: 5, y: -6, rotate: -50, size: 10 },
    { x: 15, y: 6, rotate: 45, size: 11 },
    { x: 25, y: -6, rotate: -45, size: 10 },
    { x: 35, y: 6, rotate: 50, size: 11 },
    { x: 45, y: -6, rotate: -50, size: 10 },
    { x: 55, y: 6, rotate: 45, size: 11 },
    { x: 65, y: -6, rotate: -45, size: 10 },
    { x: 75, y: 6, rotate: 50, size: 11 },
    { x: 85, y: -6, rotate: -50, size: 10 },
    { x: 95, y: 6, rotate: 45, size: 11 },
  ]

  return (
    <div className="flex-1 h-10 relative">
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 100 20" 
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Clip for the vine (0 to progress) */}
          <clipPath id="vineClipGrow">
            <motion.rect
              x="0"
              y="-5"
              height="30"
              initial={{ width: 0 }}
              animate={{ width: progress }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </clipPath>
          {/* Clip for the remaining line (progress to 100) */}
          <clipPath id="lineClipRemain">
            <motion.rect
              y="-5"
              height="30"
              width="100"
              initial={{ x: 0 }}
              animate={{ x: progress }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </clipPath>
        </defs>
        
        {/* Background straight line - ONLY shows after the vine */}
        <g clipPath="url(#lineClipRemain)">
          <line
            x1="0"
            y1="10"
            x2="100"
            y2="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-stone-300 dark:text-stone-600"
          />
        </g>
        
        {/* Growing vine with smooth waves */}
        <g clipPath="url(#vineClipGrow)">
          {/* Main vine stem - smooth wave pattern */}
          <path
            d="M 0 10 
               C 5 10, 5 5, 10 5
               C 15 5, 15 15, 20 15
               C 25 15, 25 5, 30 5
               C 35 5, 35 15, 40 15
               C 45 15, 45 5, 50 5
               C 55 5, 55 15, 60 15
               C 65 15, 65 5, 70 5
               C 75 5, 75 15, 80 15
               C 85 15, 85 5, 90 5
               C 95 5, 95 15, 100 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          />
          
          {/* Curly tendrils sprouting from the vine */}
          {/* Top tendrils at wave peaks */}
          <path d="M 10 5 Q 8 2, 11 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          <path d="M 10 5 Q 12 1, 8 -1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-accent" opacity="0.5" />
          
          <path d="M 30 5 Q 28 2, 31 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          <path d="M 30 5 Q 32 1, 28 -1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-accent" opacity="0.5" />
          
          <path d="M 50 5 Q 48 2, 51 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          
          <path d="M 70 5 Q 68 2, 71 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          <path d="M 70 5 Q 72 1, 68 -1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-accent" opacity="0.5" />
          
          <path d="M 90 5 Q 88 2, 91 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          
          {/* Bottom tendrils at wave troughs */}
          <path d="M 20 15 Q 22 18, 19 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          <path d="M 20 15 Q 18 19, 21 21" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-accent" opacity="0.5" />
          
          <path d="M 40 15 Q 42 18, 39 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          
          <path d="M 60 15 Q 62 18, 59 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
          <path d="M 60 15 Q 58 19, 61 21" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-accent" opacity="0.5" />
          
          <path d="M 80 15 Q 82 18, 79 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" opacity="0.8" />
        </g>
      </svg>
      
      {/* Animated leaves - positioned at vine wave points */}
      <div className="absolute inset-0" style={{ overflow: 'visible' }}>
        {leafPositions.map((leaf, index) => {
          const shouldShow = leaf.x <= progress - 2
          
          return (
            <motion.div
              key={index}
              className="absolute"
              style={{
                left: `${leaf.x}%`,
                top: '50%',
              }}
              initial={{ scale: 0, opacity: 0, rotate: leaf.rotate - 20 }}
              animate={{ 
                scale: shouldShow ? 1 : 0, 
                opacity: shouldShow ? 1 : 0,
                rotate: shouldShow ? leaf.rotate : leaf.rotate - 20,
              }}
              transition={{ 
                duration: 0.4, 
                delay: shouldShow ? 0.1 : 0,
                type: "spring",
                stiffness: 300,
                damping: 12
              }}
            >
              <svg 
                width={leaf.size} 
                height={leaf.size * 1.3} 
                viewBox="0 0 10 13"
                className="text-accent drop-shadow-sm"
                style={{
                  transform: `translateY(${leaf.y}px) translateX(-50%)`,
                }}
              >
                {/* Leaf shape - more natural */}
                <path
                  d="M 5 0 Q 10 4, 5 13 Q 0 4, 5 0"
                  fill="currentColor"
                />
                {/* Central vein */}
                <path
                  d="M 5 1.5 L 5 11"
                  stroke="white"
                  strokeWidth="0.5"
                  opacity="0.3"
                  fill="none"
                />
              </svg>
            </motion.div>
          )
        })}
      </div>
      
      {/* Growing tip - small bud */}
      <motion.div
        className="absolute top-1/2"
        style={{ left: `${Math.min(progress, 98)}%` }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: progress > 2 ? 1 : 0,
          opacity: progress > 2 ? 1 : 0
        }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12"
          className="text-accent drop-shadow-md"
          style={{
            transform: 'translateY(-50%) translateX(-50%)',
          }}
        >
          {/* Small sprouting bud */}
          <ellipse cx="6" cy="6" rx="4" ry="5" fill="currentColor" />
          <path
            d="M 6 2 Q 8 0, 6 -2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </motion.div>
    </div>
  )
}

// Common countries for quick selection
const POPULAR_COUNTRIES = [
  'France', 'United States', 'United Kingdom', 'Canada', 'Germany', 
  'Spain', 'Italy', 'Belgium', 'Switzerland', 'Netherlands',
  'Australia', 'Japan', 'Brazil', 'Mexico', 'Portugal'
]

export function SetupPage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const changeLanguage = useChangeLanguage()
  const currentLang = useLanguage()
  const { user, profile, refreshProfile } = useAuth()
  
  // Sync i18n with URL language on mount
  React.useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang)
    }
  }, [currentLang])
  
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

  // Auto-detect location and timezone on component mount
  // Note: We DON'T auto-change language here - respect the URL language choice
  React.useEffect(() => {
    if (locationDetected) return
    
    const detectLocation = async () => {
      setLocationLoading(true)
      try {
        // Use ip-api.com for free IP geolocation (includes timezone)
        const response = await fetch('https://ip-api.com/json/?fields=status,country,countryCode,city,timezone')
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'success') {
            // Update location data
            setSetupData(prev => ({
              ...prev,
              country: data.country || prev.country || '',
              city: data.city || prev.city || '',
              timezone: data.timezone || prev.timezone || 'UTC',
            }))
            
            // Only auto-set language if user is on default (English) route
            // If they navigated to /fr/setup explicitly, respect that choice
            if (currentLang === 'en') {
              const detectedLang = COUNTRY_TO_LANGUAGE[data.countryCode] || 'en'
              if (detectedLang !== 'en') {
                changeLanguage(detectedLang)
                console.log('[setup] Auto-switching language to:', detectedLang)
              }
            }
            
            setLocationDetected(true)
            console.log('[setup] Location detected:', data.country, data.city, 'Timezone:', data.timezone)
          }
        }
      } catch (err) {
        console.warn('[setup] Failed to detect location:', err)
      } finally {
        setLocationLoading(false)
      }
    }
    
    detectLocation()
  }, [locationDetected, changeLanguage, currentLang])

  // Redirect if no user or already completed setup
  React.useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (profile?.setup_completed) {
      navigate('/discovery')
    }
  }, [user, profile?.setup_completed, navigate])

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

  const handleCountrySelect = (country: string) => {
    setSetupData(prev => ({ ...prev, country }))
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
      navigate('/discovery')
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

            <div className="space-y-6">
              {locationDetected && setupData.country && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2 text-sm text-accent bg-accent/10 px-4 py-2 rounded-xl">
                    <Check className="w-4 h-4" />
                    {t('setup.location.detected', 'Location detected automatically!')}
                  </div>
                  {setupData.timezone && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 px-4">
                      <Clock className="w-3 h-3" />
                      {t('setup.location.timezoneSet', 'Timezone:')} {setupData.timezone}
                    </div>
                  )}
                </motion.div>
              )}
              
              {!locationDetected && locationLoading && (
                <div className="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-4 py-3 rounded-xl">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  {t('setup.location.detecting', 'Detecting your location...')}
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  {t('setup.location.country', 'Country')} <span className="text-red-500">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_COUNTRIES.slice(0, 8).map((country) => (
                    <button
                      key={country}
                      onClick={() => handleCountrySelect(country)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        setupData.country === country
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {country}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder={t('setup.location.countryPlaceholder', 'Or type your country...')}
                  value={setupData.country}
                  onChange={(e) => setSetupData(prev => ({ ...prev, country: e.target.value }))}
                  className="rounded-xl bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  {t('setup.location.city', 'City')}
                </Label>
                <Input
                  placeholder={t('setup.location.cityPlaceholder', 'Enter your city...')}
                  value={setupData.city}
                  onChange={(e) => setSetupData(prev => ({ ...prev, city: e.target.value }))}
                  className="rounded-xl bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                />
              </div>
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
                label={t('setup.notificationTime.early', 'Early bird - 6:00 AM')}
                index={0}
              />
              <PillOption
                selected={setupData.notification_time === '10h'}
                onClick={() => handleNotificationTimeSelect('10h')}
                label={t('setup.notificationTime.morning', 'Sleep in - 10:00 AM')}
                index={1}
              />
              <PillOption
                selected={setupData.notification_time === '14h'}
                onClick={() => handleNotificationTimeSelect('14h')}
                label={t('setup.notificationTime.midday', 'Midday energy - 2:00 PM')}
                index={2}
              />
              <PillOption
                selected={setupData.notification_time === '17h'}
                onClick={() => handleNotificationTimeSelect('17h')}
                label={t('setup.notificationTime.afternoon', 'After work - 5:00 PM')}
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
            <LianaProgressBar progress={progress} />
            
            {/* Logo icon */}
            <div className="w-10 flex items-center justify-center">
              <img 
                src="/icons/plant-swipe-icon.svg" 
                alt="Aphylia"
                className="w-8 h-8 plant-icon-theme opacity-60"
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
