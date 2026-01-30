import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLanguageNavigate } from "@/lib/i18nRouting"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Check, ChevronLeft, ChevronRight, Bell, Home, Flower2, Salad, Trees, Sparkles, Sun, Coffee, Clock, Leaf, Sprout } from "lucide-react"

type SetupStep = 'welcome' | 'garden_type' | 'experience' | 'purpose' | 'notification_time' | 'notifications' | 'complete'

type GardenType = 'inside' | 'outside' | 'both'
type ExperienceLevel = 'novice' | 'intermediate' | 'expert'
type LookingFor = 'eat' | 'ornamental' | 'various'
type NotificationTime = '6h' | '10h' | '14h' | '17h'

interface SetupData {
  garden_type: GardenType | null
  experience_level: ExperienceLevel | null
  looking_for: LookingFor | null
  notification_time: NotificationTime | null
}

const STEPS: SetupStep[] = ['welcome', 'garden_type', 'experience', 'purpose', 'notification_time', 'notifications', 'complete']

export function SetupPage() {
  const { t } = useTranslation('common')
  const navigate = useLanguageNavigate()
  const { user, profile, refreshProfile } = useAuth()
  
  const [currentStep, setCurrentStep] = React.useState<SetupStep>('welcome')
  const [setupData, setSetupData] = React.useState<SetupData>({
    garden_type: null,
    experience_level: null,
    looking_for: null,
    notification_time: '10h', // Default
  })
  const [saving, setSaving] = React.useState(false)
  const [direction, setDirection] = React.useState<1 | -1>(1) // For animation direction

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

  const handleGardenTypeSelect = (type: GardenType) => {
    setSetupData(prev => ({ ...prev, garden_type: type }))
    setTimeout(goToNextStep, 300)
  }

  const handleExperienceSelect = (level: ExperienceLevel) => {
    setSetupData(prev => ({ ...prev, experience_level: level }))
    setTimeout(goToNextStep, 300)
  }

  const handlePurposeSelect = (purpose: LookingFor) => {
    setSetupData(prev => ({ ...prev, looking_for: purpose }))
    setTimeout(goToNextStep, 300)
  }

  const handleNotificationTimeSelect = (time: NotificationTime) => {
    setSetupData(prev => ({ ...prev, notification_time: time }))
    setTimeout(goToNextStep, 300)
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

  const skipNotifications = () => {
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

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  }

  const cardVariants = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    hover: { scale: 1.02, y: -4 },
    tap: { scale: 0.98 },
    selected: { scale: 1, borderColor: 'rgb(16, 185, 129)', backgroundColor: 'rgb(236, 253, 245)' },
  }

  const OptionCard: React.FC<{
    selected: boolean
    onClick: () => void
    icon: React.ReactNode
    title: string
    description?: string
    delay?: number
  }> = ({ selected, onClick, icon, title, description, delay = 0 }) => (
    <motion.button
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      variants={cardVariants}
      transition={{ delay, duration: 0.2 }}
      onClick={onClick}
      className={`relative w-full p-5 rounded-2xl border-2 text-left transition-colors ${
        selected 
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-400' 
          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 hover:border-emerald-300 dark:hover:border-emerald-600'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${
          selected 
            ? 'bg-emerald-500 text-white' 
            : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold text-lg ${
            selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-100'
          }`}>
            {title}
          </h3>
          {description && (
            <p className={`text-sm mt-1 ${
              selected ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400'
            }`}>
              {description}
            </p>
          )}
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-4 right-4 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </div>
    </motion.button>
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
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-lg mx-auto"
          >
            {/* Logo/Mascot */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
            >
              <Leaf className="w-16 h-16 text-white" />
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4"
            >
              {t('setup.welcome.title', 'Welcome to Aphylia!')}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-stone-600 dark:text-stone-300 text-lg mb-8 leading-relaxed"
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
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                onClick={goToNextStep}
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30"
              >
                {t('setup.welcome.getStarted', "Let's get started")}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
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
            transition={{ duration: 0.3 }}
            className="max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                {t('setup.gardenType.title', 'Where is your garden located?')}
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                {t('setup.gardenType.subtitle', 'This helps us recommend the right plants for you')}
              </p>
            </motion.div>

            <div className="space-y-4">
              <OptionCard
                selected={setupData.garden_type === 'outside'}
                onClick={() => handleGardenTypeSelect('outside')}
                icon={<Trees className="w-6 h-6" />}
                title={t('setup.gardenType.outside', 'Outside, in a yard')}
                description={t('setup.gardenType.outsideDesc', 'I have an outdoor garden or yard')}
                delay={0.1}
              />
              <OptionCard
                selected={setupData.garden_type === 'inside'}
                onClick={() => handleGardenTypeSelect('inside')}
                icon={<Home className="w-6 h-6" />}
                title={t('setup.gardenType.inside', 'Inside your home')}
                description={t('setup.gardenType.insideDesc', 'I grow plants indoors')}
                delay={0.2}
              />
              <OptionCard
                selected={setupData.garden_type === 'both'}
                onClick={() => handleGardenTypeSelect('both')}
                icon={<Sparkles className="w-6 h-6" />}
                title={t('setup.gardenType.both', 'Both inside and outside')}
                description={t('setup.gardenType.bothDesc', 'I have plants everywhere!')}
                delay={0.3}
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
            transition={{ duration: 0.3 }}
            className="max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                {t('setup.experience.title', "What's your gardening level?")}
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                {t('setup.experience.subtitle', "We'll adapt our advice to your expertise")}
              </p>
            </motion.div>

            <div className="space-y-4">
              <OptionCard
                selected={setupData.experience_level === 'novice'}
                onClick={() => handleExperienceSelect('novice')}
                icon={<Sprout className="w-6 h-6" />}
                title={t('setup.experience.novice', 'Novice')}
                description={t('setup.experience.noviceDesc', "I'm just starting my gardening journey")}
                delay={0.1}
              />
              <OptionCard
                selected={setupData.experience_level === 'intermediate'}
                onClick={() => handleExperienceSelect('intermediate')}
                icon={<Leaf className="w-6 h-6" />}
                title={t('setup.experience.intermediate', 'Intermediate')}
                description={t('setup.experience.intermediateDesc', 'I have some experience with plants')}
                delay={0.2}
              />
              <OptionCard
                selected={setupData.experience_level === 'expert'}
                onClick={() => handleExperienceSelect('expert')}
                icon={<Trees className="w-6 h-6" />}
                title={t('setup.experience.expert', 'Expert')}
                description={t('setup.experience.expertDesc', 'Gardening is my passion!')}
                delay={0.3}
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
            transition={{ duration: 0.3 }}
            className="max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                {t('setup.purpose.title', 'What is your purpose for your garden?')}
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                {t('setup.purpose.subtitle', "We'll personalize your plant recommendations")}
              </p>
            </motion.div>

            <div className="space-y-4">
              <OptionCard
                selected={setupData.looking_for === 'eat'}
                onClick={() => handlePurposeSelect('eat')}
                icon={<Salad className="w-6 h-6" />}
                title={t('setup.purpose.eat', 'Grow food')}
                description={t('setup.purpose.eatDesc', 'Vegetables and fruits for my own consumption')}
                delay={0.1}
              />
              <OptionCard
                selected={setupData.looking_for === 'ornamental'}
                onClick={() => handlePurposeSelect('ornamental')}
                icon={<Flower2 className="w-6 h-6" />}
                title={t('setup.purpose.ornamental', 'Ornamental garden')}
                description={t('setup.purpose.ornamentalDesc', 'Beautiful flowers and decorative plants')}
                delay={0.2}
              />
              <OptionCard
                selected={setupData.looking_for === 'various'}
                onClick={() => handlePurposeSelect('various')}
                icon={<Sparkles className="w-6 h-6" />}
                title={t('setup.purpose.various', 'A bit of everything!')}
                description={t('setup.purpose.variousDesc', 'As many various plants as possible')}
                delay={0.3}
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
            transition={{ duration: 0.3 }}
            className="max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                {t('setup.notificationTime.title', 'When should we remind you?')}
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                {t('setup.notificationTime.subtitle', 'Choose your preferred notification time')}
              </p>
            </motion.div>

            <div className="space-y-4">
              <OptionCard
                selected={setupData.notification_time === '6h'}
                onClick={() => handleNotificationTimeSelect('6h')}
                icon={<Sun className="w-6 h-6" />}
                title={t('setup.notificationTime.early', 'Early bird')}
                description={t('setup.notificationTime.earlyDesc', '6:00 AM - Start the day with your plants')}
                delay={0.1}
              />
              <OptionCard
                selected={setupData.notification_time === '10h'}
                onClick={() => handleNotificationTimeSelect('10h')}
                icon={<Coffee className="w-6 h-6" />}
                title={t('setup.notificationTime.morning', 'Sleep in')}
                description={t('setup.notificationTime.morningDesc', '10:00 AM - After your morning coffee')}
                delay={0.2}
              />
              <OptionCard
                selected={setupData.notification_time === '14h'}
                onClick={() => handleNotificationTimeSelect('14h')}
                icon={<Clock className="w-6 h-6" />}
                title={t('setup.notificationTime.midday', 'Midday energy')}
                description={t('setup.notificationTime.middayDesc', '2:00 PM - A break in your afternoon')}
                delay={0.3}
              />
              <OptionCard
                selected={setupData.notification_time === '17h'}
                onClick={() => handleNotificationTimeSelect('17h')}
                icon={<Home className="w-6 h-6" />}
                title={t('setup.notificationTime.afternoon', 'After work')}
                description={t('setup.notificationTime.afternoonDesc', '5:00 PM - Wind down with your garden')}
                delay={0.4}
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
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 mb-6 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30"
            >
              <Bell className="w-12 h-12 text-white" />
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-3"
            >
              {t('setup.notifications.title', 'Stay on top of your garden')}
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-stone-500 dark:text-stone-400 mb-8"
            >
              {t('setup.notifications.description', "Enable notifications to get reminders about watering, fertilizing, and caring for your plants at the perfect time.")}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 w-full"
            >
              <Button 
                onClick={requestNotificationPermission}
                size="lg"
                className="w-full rounded-full py-6 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
              >
                <Bell className="w-5 h-5 mr-2" />
                {t('setup.notifications.enable', 'Enable notifications')}
              </Button>
              <Button 
                onClick={skipNotifications}
                variant="ghost"
                size="lg"
                className="w-full rounded-full py-6 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                {t('setup.notifications.skip', 'Maybe later')}
              </Button>
            </motion.div>
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
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-lg mx-auto"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
            >
              <Check className="w-16 h-16 text-white" />
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4"
            >
              {t('setup.complete.title', "You're all set!")}
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-stone-500 dark:text-stone-400 text-lg mb-8"
            >
              {t('setup.complete.description', "Your garden assistant is ready to help you grow the most beautiful plants. Let's start exploring!")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                onClick={completeSetup}
                size="lg"
                disabled={saving}
                className="rounded-full px-10 py-6 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30"
              >
                {saving ? t('common.saving', 'Saving...') : t('setup.complete.button', 'Start exploring')}
                {!saving && <Sparkles className="w-5 h-5 ml-2" />}
              </Button>
            </motion.div>
          </motion.div>
        )

      default:
        return null
    }
  }

  // Don't render anything while checking auth
  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#0f1a14] dark:via-[#0d1410] dark:to-[#0a0c0b]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-1 bg-stone-200 dark:bg-stone-800">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Navigation */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousStep}
            className="rounded-full text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-white/50 dark:hover:bg-stone-800/50"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            {t('common.back', 'Back')}
          </Button>
        </div>
      )}

      {/* Skip option */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && currentStep !== 'notifications' && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextStep}
            className="rounded-full text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
          >
            {t('common.skip', 'Skip')}
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex items-center justify-center min-h-screen p-6 pt-16">
        <AnimatePresence mode="wait" custom={direction}>
          {renderStepContent()}
        </AnimatePresence>
      </div>

      {/* Step indicator dots */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-2">
          {STEPS.slice(1, -1).map((step, index) => (
            <motion.div
              key={step}
              className={`w-2 h-2 rounded-full ${
                STEPS.indexOf(step) <= currentStepIndex 
                  ? 'bg-emerald-500' 
                  : 'bg-stone-300 dark:bg-stone-600'
              }`}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ 
                scale: step === currentStep ? 1.2 : 1, 
                opacity: 1 
              }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SetupPage
