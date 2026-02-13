import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface FilterSectionHeaderProps {
  label: string
  isOpen: boolean
  onToggle: () => void
}

export const FilterSectionHeader: React.FC<FilterSectionHeaderProps> = ({
  label,
  isOpen,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    aria-expanded={isOpen}
  >
    <span>{label}</span>
    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  </button>
)
