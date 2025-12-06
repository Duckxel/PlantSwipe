import React from 'react'
import { Flame, Sprout, TreeDeciduous } from 'lucide-react'
import type { PublicGardenWithPreview } from '@/lib/gardens'
import { useTranslation } from 'react-i18next'
import { Link } from '@/components/i18n/Link'

interface PublicGardenCardProps {
  garden: PublicGardenWithPreview
}

export const PublicGardenCard: React.FC<PublicGardenCardProps> = ({ garden }) => {
  const { t } = useTranslation('common')
  const [isHovered, setIsHovered] = React.useState(false)
  
  // Get preview plants with images
  const plantsWithImages = garden.previewPlants.filter(p => p.imageUrl)
  const displayPlants = plantsWithImages.slice(0, 4)
  const hasStreak = (garden.streak ?? 0) > 0

  return (
    <Link 
      to={`/garden/${garden.id}`} 
      className="block group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        {/* Main Card Container */}
        <div 
          className="relative aspect-[4/3] overflow-hidden rounded-2xl transition-all duration-500"
          style={{
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          {/* Cover Image or Gradient Background */}
          {garden.coverImageUrl ? (
            <img 
              src={garden.coverImageUrl} 
              alt={garden.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
              style={{
                transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              }}
              loading="lazy"
              draggable="false"
            />
          ) : (
            // Beautiful gradient placeholder
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 dark:from-emerald-700 dark:via-teal-800 dark:to-cyan-900">
              {/* Decorative pattern overlay */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-4 right-4 w-24 h-24 rounded-full border-2 border-white/30" />
                <div className="absolute bottom-8 left-6 w-16 h-16 rounded-full border-2 border-white/20" />
                <div className="absolute top-1/2 left-1/3 w-8 h-8 rounded-full bg-white/10" />
              </div>
              {/* Garden icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <TreeDeciduous 
                  className="h-16 w-16 text-white/40 transition-transform duration-500"
                  style={{
                    transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Plant preview bubbles - positioned at bottom right */}
          {displayPlants.length > 0 && (
            <div 
              className="absolute bottom-12 right-3 flex items-center transition-all duration-500"
              style={{
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
              }}
            >
              {displayPlants.map((plant, idx) => (
                <div
                  key={plant.id}
                  className="relative rounded-full overflow-hidden border-2 border-white dark:border-stone-800 shadow-lg transition-transform duration-300"
                  style={{
                    width: 32,
                    height: 32,
                    marginLeft: idx === 0 ? 0 : -10,
                    zIndex: displayPlants.length - idx,
                    transform: isHovered ? `translateX(${idx * 4}px)` : 'translateX(0)',
                    transitionDelay: `${idx * 30}ms`,
                  }}
                >
                  <img
                    src={plant.imageUrl!}
                    alt={plant.nickname || plant.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable="false"
                  />
                </div>
              ))}
              {garden.plantCount > displayPlants.length && (
                <div
                  className="relative flex items-center justify-center rounded-full bg-stone-800/90 text-white text-[10px] font-medium border-2 border-white dark:border-stone-700 shadow-lg"
                  style={{
                    width: 32,
                    height: 32,
                    marginLeft: -10,
                    zIndex: 0,
                  }}
                >
                  +{garden.plantCount - displayPlants.length}
                </div>
              )}
            </div>
          )}
          
          {/* Streak badge - positioned at top right */}
          {hasStreak && (
            <div 
              className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/90 dark:bg-orange-600/90 backdrop-blur-sm text-white text-xs font-semibold shadow-lg transition-transform duration-300"
              style={{
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <Flame className="h-3 w-3" />
              <span>{garden.streak}</span>
            </div>
          )}
          
          {/* Garden name and plant count - bottom left */}
          <div className="absolute bottom-0 inset-x-0 p-3">
            <h3 
              className="font-semibold text-white truncate text-sm leading-tight drop-shadow-md transition-transform duration-300"
              style={{
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {garden.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-white/80 text-[11px]">
              <Sprout className="h-3 w-3" />
              <span>
                {garden.plantCount} {garden.plantCount === 1 
                  ? t('gardens.plant', { defaultValue: 'plant' }) 
                  : t('gardens.plants', { defaultValue: 'plants' })
                }
              </span>
            </div>
          </div>
        </div>
        
        {/* Hover glow effect */}
        <div 
          className="absolute -inset-1 rounded-3xl transition-opacity duration-500 pointer-events-none -z-10"
          style={{
            opacity: isHovered ? 1 : 0,
            background: 'radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.25) 0%, transparent 60%)',
            filter: 'blur(8px)',
          }}
        />
      </div>
    </Link>
  )
}
