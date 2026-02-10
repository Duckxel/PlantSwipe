/**
 * ScanPage Component
 * 
 * Plant identification page using Kindwise Plant.id API.
 * Users can upload photos or take pictures to identify plants.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useLanguageNavigate } from '@/lib/i18nRouting'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  Camera, 
  Upload, 
  Plus, 
  Loader2, 
  Leaf, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Trash2,
  ScanLine,
  Sparkles,
  History,
  Image as ImageIcon,
  Search,
  FlaskConical,
  X,
  ZoomIn
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CameraCapture } from '@/components/messaging/CameraCapture'
import { RequestPlantDialog } from '@/components/plant/RequestPlantDialog'
import { 
  uploadAndIdentifyPlant, 
  createPlantScan,
  getUserScans,
  deleteScan,
  formatProbability,
  getConfidenceLevel
} from '@/lib/plantScan'
import type { PlantScan } from '@/types/scan'
import { usePageMetadata } from '@/hooks/usePageMetadata'

export const ScanPage: React.FC = () => {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const navigate = useLanguageNavigate()
  
  usePageMetadata({ 
    title: t('scan.pageTitle', { defaultValue: 'Plant Scanner' }),
    description: t('scan.pageDescription', { defaultValue: 'Identify any plant by taking a photo or uploading an image' })
  })
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  // Pagination constants
  const SCANS_PER_PAGE = 10
  
  // State
  const [scans, setScans] = React.useState<PlantScan[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  // Scan flow state
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [isIdentifying, setIsIdentifying] = React.useState(false)
  const [identifyError, setIdentifyError] = React.useState<string | null>(null)
  const [currentResult, setCurrentResult] = React.useState<PlantScan | null>(null)
  const [showResultDialog, setShowResultDialog] = React.useState(false)
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  // Request plant dialog
  const [showRequestDialog, setShowRequestDialog] = React.useState(false)
  const [requestPlantName, setRequestPlantName] = React.useState<string>('')
  
  // Fullscreen image viewer
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null)
  
  // Load user's scans (initial load)
  const loadScans = React.useCallback(async () => {
    if (!user?.id) return
    try {
      setError(null)
      const data = await getUserScans({ limit: SCANS_PER_PAGE })
      setScans(data)
      setHasMore(data.length === SCANS_PER_PAGE)
    } catch (e: any) {
      console.error('[scan] Failed to load scans:', e)
      setError(e?.message || t('scan.errors.loadFailed', { defaultValue: 'Failed to load your scans' }))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])
  
  // Load more scans (pagination)
  // Note: recheckMatches is enabled (default) to ensure consistent UX across all pages
  const loadMoreScans = async () => {
    if (!user?.id || loadingMore || !hasMore) return
    try {
      setLoadingMore(true)
      const data = await getUserScans({ 
        limit: SCANS_PER_PAGE, 
        offset: scans.length
        // recheckMatches defaults to true for consistent experience
      })
      setScans(prev => [...prev, ...data])
      setHasMore(data.length === SCANS_PER_PAGE)
    } catch (e: any) {
      console.error('[scan] Failed to load more scans:', e)
    } finally {
      setLoadingMore(false)
    }
  }
  
  React.useEffect(() => {
    loadScans()
  }, [loadScans])
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }
  
  // Handle camera capture
  const handleCameraCapture = (file: File) => {
    setCameraOpen(false)
    processSelectedFile(file)
  }
  
  // Process selected file and start identification
  const processSelectedFile = async (file: File) => {
    setSelectedFile(file)
    setIdentifyError(null)
    setCurrentResult(null)
    
    // Create preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    
    // Start identification
    await identifyPlantFromFile(file)
  }
  
  // Identify plant from file
  const identifyPlantFromFile = async (file: File) => {
    setIsIdentifying(true)
    setIdentifyError(null)
    
    try {
      // Combined upload + identify in a single request
      // Uses same optimization as Admin/Garden Cover/Messages uploads
      // Always use 'all' classification_level for maximum detail including cultivars
      const result = await uploadAndIdentifyPlant(file, {
        classificationLevel: 'all'
      })
      
      // Check if it's a plant
      if (!result.identification.result?.is_plant?.binary) {
        setIdentifyError(t('scan.errors.notAPlant', { 
          defaultValue: 'This doesn\'t appear to be a plant. Please try a different image.' 
        }))
        setIsIdentifying(false)
        return
      }
      
      // Save to database with classification level for reference
      const scan = await createPlantScan(
        result.upload.url, 
        result.upload.path, 
        result.identification,
        { classificationLevel: 'all' }
      )
      
      setCurrentResult(scan)
      setShowResultDialog(true)
      
      // Refresh scans list
      await loadScans()
      
    } catch (e: any) {
      console.error('[scan] Identification failed:', e)
      setIdentifyError(e?.message || t('scan.errors.identifyFailed', { 
        defaultValue: 'Failed to identify plant. Please try again.' 
      }))
    } finally {
      setIsIdentifying(false)
    }
  }
  
  // Handle delete scan
  const handleDeleteScan = async (scanId: string) => {
    setIsDeleting(true)
    try {
      await deleteScan(scanId)
      setScans(prev => prev.filter(s => s.id !== scanId))
      setDeleteConfirmId(null)
    } catch (e: any) {
      console.error('[scan] Delete failed:', e)
    } finally {
      setIsDeleting(false)
    }
  }
  
  // Reset scan flow
  const resetScanFlow = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setIdentifyError(null)
    setCurrentResult(null)
    setShowResultDialog(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Navigate to plant info
  const goToPlantInfo = (plantId: string) => {
    navigate(`/plants/${plantId}`)
  }
  
  // Open request plant dialog with pre-filled name
  const handleRequestPlant = (plantName: string) => {
    setRequestPlantName(plantName)
    setShowRequestDialog(true)
  }
  
  // Determine the type of infraspecies and return appropriate label and display value
  const getInfraspeciesInfo = (infraspecies: string | undefined): { label: string; value: string } | null => {
    if (!infraspecies) return null
    
    const raw = infraspecies.trim()
    const lower = raw.toLowerCase()
    
    // Check for cultivar indicators (quotes or cv. prefix)
    if (raw.startsWith("'") || raw.endsWith("'") || raw.includes('"') || lower.startsWith('cv.')) {
      const cleanValue = raw.replace(/^cv\.\s*/i, '').replace(/['"]/g, '')
      return { label: 'Cultivar', value: `'${cleanValue}'` }
    }
    
    // Check for variety
    if (lower.startsWith('var.')) {
      const cleanValue = raw.replace(/^var\.\s*/i, '')
      return { label: 'Variety', value: cleanValue }
    }
    
    // Check for subspecies
    if (lower.startsWith('subsp.') || lower.startsWith('ssp.')) {
      const cleanValue = raw.replace(/^(subsp\.|ssp\.)\s*/i, '')
      return { label: 'Subspecies', value: cleanValue }
    }
    
    // Check for forma
    if (lower.startsWith('f.') || lower.startsWith('forma')) {
      const cleanValue = raw.replace(/^(f\.|forma)\s*/i, '')
      return { label: 'Form', value: cleanValue }
    }
    
    // Default: assume it's a cultivar if it starts with uppercase, otherwise variety
    if (raw.match(/^[A-Z]/)) {
      return { label: 'Cultivar', value: `'${raw}'` }
    }
    
    return { label: 'Variety', value: raw }
  }
  
  // Build full scientific name from taxonomy parts
  const buildFullScientificName = (suggestion: PlantScan['suggestions'][0] | undefined) => {
    if (!suggestion) return null
    
    const parts: string[] = []
    
    if (suggestion.genus) {
      parts.push(suggestion.genus)
    }
    if (suggestion.species) {
      parts.push(suggestion.species)
    }
    if (suggestion.infraspecies) {
      // Use infraspecies as-is if it already appears formatted (quotes or known prefixes),
      // otherwise default to treating it as a variety.
      const rawInfraspecies = suggestion.infraspecies.trim()
      const lowerInfraspecies = rawInfraspecies.toLowerCase()
      const hasQuotes =
        rawInfraspecies.startsWith("'") ||
        rawInfraspecies.endsWith("'") ||
        rawInfraspecies.includes('"')
      const hasKnownPrefix =
        lowerInfraspecies.startsWith('var.') ||
        lowerInfraspecies.startsWith('subsp.') ||
        lowerInfraspecies.startsWith('ssp.') ||
        lowerInfraspecies.startsWith('cv.')

      if (hasQuotes || hasKnownPrefix) {
        parts.push(rawInfraspecies)
      } else {
        parts.push(`var. ${rawInfraspecies}`)
      }
    }
    
    return parts.length > 0 ? parts.join(' ') : null
  }
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <ScanLine className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
          {t('scan.signInTitle', { defaultValue: 'Sign in to Scan Plants' })}
        </h2>
        <p className="text-stone-500 dark:text-stone-400 max-w-sm">
          {t('scan.signInDescription', { defaultValue: 'Please log in to identify plants and save your scan history.' })}
        </p>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-white mb-2">
          {t('scan.title', { defaultValue: 'Plant Scanner' })}
        </h1>
        <p className="text-stone-500 dark:text-stone-400">
          {t('scan.subtitle', { defaultValue: 'Take a photo or upload an image to identify any plant' })}
        </p>
      </div>
      
      {/* New Scan Card */}
      <Card className="mb-8 p-6 rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10">
        {isIdentifying ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative mb-6">
              {previewUrl && (
                <img 
                  src={previewUrl} 
                  alt="Scanning" 
                  className="w-32 h-32 rounded-2xl object-cover shadow-lg"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-black/30 backdrop-blur-sm" />
                <Loader2 className="h-12 w-12 animate-spin text-white relative z-10" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('scan.identifying', { defaultValue: 'Identifying plant...' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 text-center max-w-xs">
              {t('scan.identifyingHint', { defaultValue: 'Our AI is analyzing your image. This usually takes a few seconds.' })}
            </p>
          </div>
        ) : identifyError ? (
          // Error state
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('scan.errorTitle', { defaultValue: 'Identification Failed' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 text-center max-w-xs mb-6">
              {identifyError}
            </p>
            <Button onClick={resetScanFlow} variant="outline" className="rounded-full">
              {t('scan.tryAgain', { defaultValue: 'Try Again' })}
            </Button>
          </div>
        ) : (
          // Ready state
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
              <Leaf className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {t('scan.newScanTitle', { defaultValue: 'Identify a Plant' })}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 text-center max-w-xs mb-6">
              {t('scan.newScanHint', { defaultValue: 'Take a clear photo of a leaf, flower, or the whole plant for best results.' })}
            </p>
            
            <div className="flex gap-3">
              <Button 
                onClick={() => setCameraOpen(true)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Camera className="h-5 w-5" />
                {t('scan.takePhoto', { defaultValue: 'Take Photo' })}
              </Button>
              
              <Button 
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="rounded-full gap-2"
              >
                <Upload className="h-5 w-5" />
                {t('scan.uploadImage', { defaultValue: 'Upload' })}
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </Card>
      
      {/* Scan History */}
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-stone-400" />
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
          {t('scan.history', { defaultValue: 'Your Scans' })}
        </h2>
        <Badge variant="secondary" className="rounded-full">
          {scans.length}
        </Badge>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      ) : error ? (
        <Card className="p-6 rounded-2xl text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={loadScans} variant="outline" className="mt-4 rounded-full">
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </Card>
      ) : scans.length === 0 ? (
        <Card className="p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="h-8 w-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
            {t('scan.noScans', { defaultValue: 'No scans yet' })}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
            {t('scan.noScansHint', { defaultValue: 'Take a photo or upload an image of a plant to get started.' })}
          </p>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scans.map((scan) => {
            const confidence = scan.topMatchProbability 
              ? getConfidenceLevel(scan.topMatchProbability)
              : null
            const topSuggestion = scan.suggestions?.[0]
            const scientificName = buildFullScientificName(topSuggestion)
            
            return (
              <Card 
                key={scan.id}
                className="group relative overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-700 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => {
                  setCurrentResult(scan)
                  setShowResultDialog(true)
                }}
              >
                <div className="flex gap-4 p-4">
                  {/* Image */}
                  <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800">
                    {scan.imageUrl ? (
                      <img 
                        src={scan.imageUrl} 
                        alt={scan.topMatchName || 'Plant scan'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="h-8 w-8 text-stone-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0 py-1 pr-8">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-stone-900 dark:text-white truncate">
                        {scan.topMatchName || t('scan.unknownPlant', { defaultValue: 'Unknown Plant' })}
                      </h3>
                      {/* Scientific name if available */}
                      {scientificName && scientificName !== scan.topMatchName && (
                        <p className="text-xs italic text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {scientificName}
                        </p>
                      )}
                      {scan.topMatchProbability && confidence && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={cn("rounded-full text-xs", confidence.color)}
                          >
                            {formatProbability(scan.topMatchProbability)}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {formatDate(scan.createdAt)}
                      </span>
                      {scan.matchedPlant && (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('scan.inDatabase', { defaultValue: 'In Database' })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirmId(scan.id)
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-white/80 dark:bg-stone-800/80 text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            )
          })}
        </div>
        
        {/* Load More Button */}
        {hasMore && scans.length > 0 && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={loadMoreScans}
              variant="outline"
              className="rounded-full gap-2"
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading', { defaultValue: 'Loading...' })}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {t('scan.loadMore', { defaultValue: 'Load More' })}
                </>
              )}
            </Button>
          </div>
        )}
        </>
      )}
      
      {/* Camera Dialog */}
      <CameraCapture 
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
      />
      
      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={(open) => {
        setShowResultDialog(open)
        if (!open) {
          resetScanFlow()
        }
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              {t('scan.resultTitle', { defaultValue: 'Identification Result' })}
            </DialogTitle>
            <DialogDescription>
              {t('scan.resultDescription', { defaultValue: 'Here\'s what we found based on your image.' })}
            </DialogDescription>
          </DialogHeader>
          
          {currentResult && (
            <div className="space-y-6 mt-2">
              {/* Scanned image - clickable to view fullscreen */}
              {currentResult.imageUrl && (
                <div 
                  className="relative rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer group"
                  onClick={() => setFullscreenImage(currentResult.imageUrl!)}
                >
                  <img 
                    src={currentResult.imageUrl}
                    alt="Scanned plant"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              )}
              
              {/* Top match */}
              {currentResult.topMatchName && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                        {t('scan.topMatch', { defaultValue: 'Best Match' })}
                      </p>
                      
                      {/* Main plant name - clickable to search */}
                      <button
                        onClick={() => navigate(`/search?q=${encodeURIComponent(currentResult.topMatchName!)}`)}
                        className="text-xl font-bold text-stone-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left underline decoration-dotted underline-offset-2 cursor-pointer"
                        title={t('scan.searchForPlant', { defaultValue: 'Search for this plant in our encyclopedia' })}
                      >
                        {currentResult.topMatchName}
                      </button>
                      
                      {/* Full scientific name with taxonomy */}
                      {currentResult.suggestions?.[0] && (
                        <div className="mt-3 space-y-2">
                          {/* Full scientific name display */}
                          {buildFullScientificName(currentResult.suggestions[0]) && (
                            <div className="p-2 rounded-lg bg-white/60 dark:bg-stone-800/40 border border-emerald-100 dark:border-emerald-900/50">
                              <p className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">
                                {t('scan.scientificName', { defaultValue: 'Scientific Name' })}
                              </p>
                              <p className="text-sm font-medium italic text-stone-800 dark:text-stone-200">
                                {buildFullScientificName(currentResult.suggestions[0])}
                              </p>
                            </div>
                          )}
                          
                          {/* Taxonomy breakdown badges */}
                          {(currentResult.suggestions[0].genus || currentResult.suggestions[0].species || currentResult.suggestions[0].infraspecies) && (
                            <div className="flex flex-wrap gap-1.5">
                              {currentResult.suggestions[0].genus && (
                                <Badge variant="outline" className="rounded-full bg-white/50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-300 text-xs">
                                  <span className="text-stone-400 mr-1">{t('scan.genus', { defaultValue: 'Genus' })}:</span>
                                  <span className="italic font-medium">{currentResult.suggestions[0].genus}</span>
                                </Badge>
                              )}
                              {currentResult.suggestions[0].species && (
                                <Badge variant="outline" className="rounded-full bg-white/50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-300 text-xs">
                                  <span className="text-stone-400 mr-1">{t('scan.species', { defaultValue: 'Species' })}:</span>
                                  <span className="italic font-medium">{currentResult.suggestions[0].species}</span>
                                </Badge>
                              )}
                              {currentResult.suggestions[0].infraspecies && (() => {
                                const infraInfo = getInfraspeciesInfo(currentResult.suggestions[0].infraspecies)
                                if (!infraInfo) return null
                                return (
                                  <Badge variant="outline" className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs">
                                    <FlaskConical className="h-3 w-3 mr-1" />
                                    <span className="text-amber-500 mr-1">{t(`scan.${infraInfo.label.toLowerCase()}`, { defaultValue: infraInfo.label })}:</span>
                                    <span className="font-medium">{infraInfo.value}</span>
                                  </Badge>
                                )
                              })()}
                            </div>
                          )}
                          
                          {/* Common names */}
                          {currentResult.suggestions[0].commonNames && currentResult.suggestions[0].commonNames.length > 0 && (
                            <div className="text-xs text-stone-500 dark:text-stone-400">
                              <span className="font-medium">{t('scan.commonNames', { defaultValue: 'Also known as' })}:</span>{' '}
                              {currentResult.suggestions[0].commonNames.slice(0, 5).join(', ')}
                              {currentResult.suggestions[0].commonNames.length > 5 && (
                                <span className="text-stone-400"> +{currentResult.suggestions[0].commonNames.length - 5} more</span>
                              )}
                            </div>
                          )}
                          
                          {/* Synonyms if available */}
                          {currentResult.suggestions[0].synonyms && currentResult.suggestions[0].synonyms.length > 0 && (
                            <div className="text-xs text-stone-400 dark:text-stone-500">
                              <span className="font-medium">{t('scan.synonyms', { defaultValue: 'Synonyms' })}:</span>{' '}
                              <span className="italic">{currentResult.suggestions[0].synonyms.slice(0, 3).join(', ')}</span>
                              {currentResult.suggestions[0].synonyms.length > 3 && (
                                <span> +{currentResult.suggestions[0].synonyms.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {currentResult.topMatchProbability && (
                      <Badge 
                        className={cn(
                          "rounded-full text-lg font-bold px-3 py-1 flex-shrink-0 ml-2",
                          getConfidenceLevel(currentResult.topMatchProbability).level === 'high' 
                            ? "bg-emerald-600 text-white" 
                            : getConfidenceLevel(currentResult.topMatchProbability).level === 'medium'
                            ? "bg-amber-500 text-white"
                            : "bg-red-500 text-white"
                        )}
                      >
                        {formatProbability(currentResult.topMatchProbability)}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="mt-4 space-y-2">
                    {/* Link to database plant (if exact match found) */}
                    {currentResult.matchedPlant ? (
                      <Button 
                        onClick={() => goToPlantInfo(currentResult.matchedPlant!.id)}
                        className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t('scan.viewInDatabase', { defaultValue: 'View in Our Database' })}
                      </Button>
                    ) : (
                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 dark:border-stone-700 dark:bg-stone-900/40 p-3 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                            {t('scan.notInDatabaseYet', { defaultValue: 'This plant is not in our database yet' })}
                          </p>
                          <p className="text-xs text-stone-600 dark:text-stone-300/90 mt-1">
                            {t('scan.notInDatabaseHint', { defaultValue: 'Tap the button below to request this plant and we will review adding it.' })}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleRequestPlant(currentResult.topMatchName!)}
                          className="w-full rounded-full bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          {t('scan.requestPlant', { defaultValue: 'Request This Plant' })}
                        </Button>
                      </div>
                    )}
                    
                    {/* Search in encyclopedia */}
                    <Button 
                      onClick={() => navigate(`/search?q=${encodeURIComponent(currentResult.topMatchName!)}`)}
                      variant="outline"
                      className="w-full rounded-full gap-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                    >
                      <Search className="h-4 w-4" />
                      {t('scan.searchInEncyclopedia', { defaultValue: 'Search in Encyclopedia' })}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Other suggestions */}
              {currentResult.suggestions && currentResult.suggestions.length > 1 && (
                <div>
                  <h4 className="text-sm font-medium text-stone-900 dark:text-white mb-3">
                    {t('scan.otherSuggestions', { defaultValue: 'Other Possibilities' })}
                  </h4>
                  <div className="space-y-2">
                    {currentResult.suggestions.slice(1, 5).map((suggestion, idx) => (
                      <button 
                        key={suggestion.id || idx}
                        onClick={() => navigate(`/search?q=${encodeURIComponent(suggestion.name)}`)}
                        className="flex items-start justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 w-full text-left hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors cursor-pointer group"
                        title={t('scan.searchForPlant', { defaultValue: 'Search for this plant in our encyclopedia' })}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {suggestion.name}
                          </span>
                          {/* Show infraspecies/cultivar if available */}
                          {suggestion.infraspecies && (() => {
                            const infraInfo = getInfraspeciesInfo(suggestion.infraspecies)
                            if (!infraInfo) return null
                            return (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="rounded-full text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                  <FlaskConical className="h-2.5 w-2.5 mr-1" />
                                  {infraInfo.value}
                                </Badge>
                              </div>
                            )
                          })()}
                          {/* Show common names if available */}
                          {suggestion.commonNames && suggestion.commonNames.length > 0 && (
                            <p className="text-xs text-stone-400 mt-0.5 truncate">
                              {suggestion.commonNames.slice(0, 2).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Badge variant="outline" className="rounded-full text-xs">
                            {formatProbability(suggestion.probability)}
                          </Badge>
                          <Search className="h-3.5 w-3.5 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Similar images - clickable to view fullscreen */}
              {currentResult.suggestions?.[0]?.similarImages && currentResult.suggestions[0].similarImages.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-stone-900 dark:text-white mb-3">
                    {t('scan.similarImages', { defaultValue: 'Similar Images' })}
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {currentResult.suggestions[0].similarImages.slice(0, 6).map((img, idx) => (
                      <div 
                        key={img.id || idx}
                        className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer group relative"
                        onClick={() => setFullscreenImage(img.url)}
                      >
                        <img 
                          src={img.urlSmall || img.url}
                          alt={`Similar image ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-stone-200 dark:border-stone-700">
                <Button
                  onClick={() => {
                    setShowResultDialog(false)
                    resetScanFlow()
                  }}
                  className="flex-1 rounded-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('scan.scanAnother', { defaultValue: 'Scan Another' })}
                </Button>
                <Button
                  onClick={() => setShowResultDialog(false)}
                  variant="outline"
                  className="rounded-full"
                >
                  {t('common.close', { defaultValue: 'Close' })}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              {t('scan.deleteTitle', { defaultValue: 'Delete Scan?' })}
            </DialogTitle>
            <DialogDescription>
              {t('scan.deleteDescription', { defaultValue: 'This will permanently remove this scan from your history. This action cannot be undone.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => setDeleteConfirmId(null)}
              variant="outline"
              className="flex-1 rounded-full"
              disabled={isDeleting}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              onClick={() => deleteConfirmId && handleDeleteScan(deleteConfirmId)}
              variant="destructive"
              className="flex-1 rounded-full"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Request Plant Dialog */}
      <RequestPlantDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        initialPlantName={requestPlantName}
      />
      
      {/* Fullscreen Image Viewer */}
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none rounded-2xl overflow-hidden">
          <DialogTitle className="sr-only">
            {t('scan.fullscreenImageTitle', { defaultValue: 'Fullscreen image view' })}
          </DialogTitle>
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          {fullscreenImage && (
            <div className="flex items-center justify-center w-full h-full min-h-[50vh]">
              <img 
                src={fullscreenImage}
                alt="Fullscreen view"
                className="max-w-full max-h-[90vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ScanPage
