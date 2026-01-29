import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Link } from '@/components/i18n/Link'
import { AlertTriangle, FileText, Shield, ExternalLink, ArrowLeft, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { 
  CURRENT_TERMS_VERSION, 
  CURRENT_PRIVACY_VERSION,
  TERMS_LAST_UPDATED,
  PRIVACY_LAST_UPDATED 
} from '@/context/AuthContext'

type LegalUpdateModalProps = {
  open: boolean
  userId: string
  userTermsVersion: string | null
  userPrivacyVersion: string | null
  onAccepted: () => void
  onDeclined: () => void
}

type ModalStep = 'review' | 'confirm-decline'

/**
 * Compare semantic versions (e.g., "1.0.0" vs "1.0.1")
 * Returns true if userVersion is less than currentVersion
 */
function isVersionOutdated(userVersion: string | null, currentVersion: string): boolean {
  if (!userVersion) return true
  
  const userParts = userVersion.split('.').map(Number)
  const currentParts = currentVersion.split('.').map(Number)
  
  for (let i = 0; i < Math.max(userParts.length, currentParts.length); i++) {
    const userPart = userParts[i] || 0
    const currentPart = currentParts[i] || 0
    
    if (userPart < currentPart) return true
    if (userPart > currentPart) return false
  }
  
  return false // Equal versions
}

export function useNeedsLegalUpdate(
  termsVersion: string | null | undefined, 
  privacyVersion: string | null | undefined
) {
  const needsTermsUpdate = isVersionOutdated(termsVersion ?? null, CURRENT_TERMS_VERSION)
  const needsPrivacyUpdate = isVersionOutdated(privacyVersion ?? null, CURRENT_PRIVACY_VERSION)
  
  return {
    needsUpdate: needsTermsUpdate || needsPrivacyUpdate,
    needsTermsUpdate,
    needsPrivacyUpdate,
  }
}

function formatDate(isoDate: string, locale?: string): string {
  try {
    return new Date(isoDate).toLocaleDateString(locale || undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export function LegalUpdateModal({
  open,
  userId,
  userTermsVersion,
  userPrivacyVersion,
  onAccepted,
  onDeclined,
}: LegalUpdateModalProps) {
  const { t, i18n } = useTranslation('common')
  const currentLocale = i18n.language || 'en'
  
  const [step, setStep] = React.useState<ModalStep>('review')
  const [accepting, setAccepting] = React.useState(false)
  const [declining, setDeclining] = React.useState(false)
  
  const { needsTermsUpdate, needsPrivacyUpdate } = useNeedsLegalUpdate(
    userTermsVersion,
    userPrivacyVersion
  )
  
  const handleAccept = async () => {
    setAccepting(true)
    try {
      const now = new Date().toISOString()
      const updates: Record<string, string> = {}
      
      if (needsTermsUpdate) {
        updates.terms_version_accepted = CURRENT_TERMS_VERSION
        updates.terms_accepted_date = now
      }
      if (needsPrivacyUpdate) {
        updates.privacy_version_accepted = CURRENT_PRIVACY_VERSION
        updates.privacy_policy_accepted_date = now
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
      
      if (error) {
        console.error('[LegalUpdateModal] Failed to update acceptance:', error)
        alert(t('legal.updateFailed', 'Failed to save your acceptance. Please try again.'))
        setAccepting(false)
        return
      }
      
      onAccepted()
    } catch (err) {
      console.error('[LegalUpdateModal] Unexpected error:', err)
      alert(t('legal.updateFailed', 'Failed to save your acceptance. Please try again.'))
    } finally {
      setAccepting(false)
    }
  }
  
  const handleConfirmDecline = async () => {
    setDeclining(true)
    try {
      // Set threat_level to 3 to block the user
      const { error } = await supabase
        .from('profiles')
        .update({ threat_level: 3 })
        .eq('id', userId)
      
      if (error) {
        console.error('[LegalUpdateModal] Failed to block user:', error)
      }
      
      onDeclined()
    } catch (err) {
      console.error('[LegalUpdateModal] Unexpected error:', err)
      onDeclined()
    }
  }
  
  // Reset step when modal opens
  React.useEffect(() => {
    if (open) {
      setStep('review')
    }
  }, [open])
  
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-lg mx-4 rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 'review' ? (
          <>
            <DialogHeader className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <DialogTitle className="text-xl font-bold">
                  {t('legal.updateRequired', 'Legal Documents Updated')}
                </DialogTitle>
              </div>
              <DialogDescription className="text-stone-600 dark:text-stone-400">
                {t('legal.updateDescription', 
                  'We have updated our legal documents. Please review and accept the new terms to continue using Aphylia.'
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 my-4">
              {needsTermsUpdate && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-stone-900 dark:text-stone-100">
                        {t('legal.termsOfService', 'Terms of Service')}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        v{CURRENT_TERMS_VERSION}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {t('legal.updatedOn', 'Updated on')} {formatDate(TERMS_LAST_UPDATED, currentLocale)}
                    </p>
                    <Link 
                      to="/terms" 
                      target="_blank"
                      className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
                    >
                      {t('legal.readTerms', 'Read Terms of Service')}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
              
              {needsPrivacyUpdate && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-stone-900 dark:text-stone-100">
                        {t('legal.privacyPolicy', 'Privacy Policy')}
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        v{CURRENT_PRIVACY_VERSION}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {t('legal.updatedOn', 'Updated on')} {formatDate(PRIVACY_LAST_UPDATED, currentLocale)}
                    </p>
                    <Link 
                      to="/privacy" 
                      target="_blank"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
                    >
                      {t('legal.readPrivacy', 'Read Privacy Policy')}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
              {t('legal.acceptanceNote', 
                'By clicking "I Accept", you agree to be bound by the updated terms. If you decline, your account will be blocked until you accept.'
              )}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                onClick={() => setStep('confirm-decline')}
                disabled={accepting}
              >
                {t('legal.decline', 'I Decline')}
              </Button>
              <Button
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? t('legal.accepting', 'Accepting...') : t('legal.accept', 'I Accept')}
              </Button>
            </div>
          </>
        ) : (
          /* Step 2: Confirm Decline - Show consequences and allow going back */
          <>
            <DialogHeader className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <Ban className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <DialogTitle className="text-xl font-bold text-red-600 dark:text-red-400">
                  {t('legal.declineWarningTitle', 'Are you sure?')}
                </DialogTitle>
              </div>
            </DialogHeader>
            
            <div className="my-4 space-y-4">
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                  {t('legal.consequencesTitle', 'If you decline, the following will happen:')}
                </h4>
                <ul className="space-y-2 text-sm text-red-700 dark:text-red-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>{t('legal.consequence1', 'Your account will be immediately blocked')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>{t('legal.consequence2', 'You will be signed out and unable to log back in')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>{t('legal.consequence3', 'You will lose access to all your data, gardens, and plants')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>{t('legal.consequence4', 'To regain access, you must contact support')}</span>
                  </li>
                </ul>
              </div>
              
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {t('legal.reconsiderMessage', 
                  'We encourage you to review the updated documents. If you have concerns, please contact our support team before declining.'
                )}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setStep('review')}
                disabled={declining}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('legal.goBack', 'Go Back & Accept')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
                onClick={handleConfirmDecline}
                disabled={declining}
              >
                {declining 
                  ? t('legal.blockingAccount', 'Blocking account...') 
                  : t('legal.confirmDecline', 'I Understand, Decline')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default LegalUpdateModal
