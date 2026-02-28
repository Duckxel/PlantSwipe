/**
 * Complete Advanced Plant Form - All Fields
 * Comprehensive form component for the structured plant schema.
 *
 * Due to the extensive nature of this form, it's organized into collapsible sections
 * for better UX. All fields are optional and can be empty.
 */

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type {
  PlantIdentifiers,
  PlantTraits,
  PlantDimensions,
  PlantPhenology,
  PlantEnvironment,
  PlantCare,
  PlantPropagation,
  PlantUsage,
  PlantEcology,
  PlantCommerce,
  PlantProblems,
  PlantPlanting,
  PlantMeta,
  PlantClassification,
  PlantActivityValue,
  PlantSubActivityValue,
} from "@/types/plant"
import {
  PLANT_ACTIVITY_OPTIONS,
  PLANT_SUBACTIVITY_OPTIONS,
  PLANT_SUBCLASS_OPTIONS,
  PLANT_SUBSUBCLASS_OPTIONS,
  PLANT_TYPE_OPTIONS,
  formatClassificationLabel,
} from "@/constants/classification"

/* eslint-disable @typescript-eslint/no-explicit-any -- heavy use of dynamic form/plant schema data */
const selectBaseClass = "h-9 w-full rounded-md px-3 py-1 text-sm"

// Helper component for array inputs
const ArrayInputField: React.FC<{
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}> = ({ label, values, onChange, placeholder }) => {
  const [input, setInput] = React.useState("")
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (input.trim()) {
                onChange([...values, input.trim()])
                setInput("")
              }
            }
          }}
          placeholder={placeholder || "Enter and press Enter"}
        />
        <Button
          type="button"
          onClick={() => {
            if (input.trim()) {
              onChange([...values, input.trim()])
              setInput("")
            }
          }}
        >
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span key={i} className="px-2 py-1 bg-stone-100 dark:bg-[#2d2d30] rounded text-sm flex items-center gap-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper for multi-select buttons
const MultiSelectButtons: React.FC<{
  label: string
  values: string[]
  options: readonly string[]
  onChange: (values: string[]) => void
}> = ({ label, values, options, onChange }) => {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt))
    } else {
      onChange([...values, opt])
    }
  }
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-2xl text-sm border transition ${
              values.includes(opt)
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// Month selector
const MonthSelectorField: React.FC<{
  label: string
  values: number[]
  onChange: (values: number[]) => void
}> = ({ label, values, onChange }) => {
  const months = [
    { n: 1, l: "Jan" }, { n: 2, l: "Feb" }, { n: 3, l: "Mar" },
    { n: 4, l: "Apr" }, { n: 5, l: "May" }, { n: 6, l: "Jun" },
    { n: 7, l: "Jul" }, { n: 8, l: "Aug" }, { n: 9, l: "Sep" },
    { n: 10, l: "Oct" }, { n: 11, l: "Nov" }, { n: 12, l: "Dec" }
  ]
  const toggle = (m: number) => {
    if (values.includes(m)) {
      onChange(values.filter(v => v !== m).sort((a, b) => a - b))
    } else {
      onChange([...values, m].sort((a, b) => a - b))
    }
  }
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {months.map(m => (
          <button
            key={m.n}
            type="button"
            onClick={() => toggle(m.n)}
            className={`px-3 py-1 rounded-2xl text-sm border transition ${
              values.includes(m.n)
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>
    </div>
  )
}

const KeyValueList: React.FC<{
  label: string
  entries?: Record<string, string>
  onChange: (entries: Record<string, string> | undefined) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}> = ({ label, entries, onChange, keyPlaceholder, valuePlaceholder }) => {
  const [keyInput, setKeyInput] = React.useState("")
  const [valueInput, setValueInput] = React.useState("")
  const entryList = Object.entries(entries ?? {})

  const commit = () => {
    if (!keyInput.trim() || !valueInput.trim()) return
    const next = { ...(entries ?? {}), [keyInput.trim()]: valueInput.trim() }
    onChange(next)
    setKeyInput("")
    setValueInput("")
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap md:flex-nowrap">
          <Input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={keyPlaceholder || "Key"}
            className="md:flex-1"
          />
          <Input
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            placeholder={valuePlaceholder || "Value"}
            className="md:flex-1"
          />
          <Button type="button" onClick={commit}>
            Add
          </Button>
        </div>
        {entryList.length > 0 && (
          <div className="space-y-2">
            {entryList.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-stone-50 dark:bg-[#2d2d30] dark:border-[#3e3e42]">
                <div className="flex-1">
                  <div className="font-medium">{key}</div>
                  <div className="text-xs opacity-70 break-all">{value}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    const next = { ...(entries ?? {}) }
                    delete next[key]
                    onChange(Object.keys(next).length === 0 ? undefined : next)
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className="border rounded-lg p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left font-semibold mb-2"
      >
        <span>{title}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-4 mt-4">{children}</div>}
    </div>
  )
}

interface CompleteAdvancedFormProps {
  // All form state
  classification: Partial<PlantClassification>
  setClassification: React.Dispatch<React.SetStateAction<Partial<PlantClassification>>>
  focusClassificationTabSignal?: number
  identifiers: Partial<PlantIdentifiers>
  setIdentifiers: React.Dispatch<React.SetStateAction<Partial<PlantIdentifiers>>>
  traits: Partial<PlantTraits>
  setTraits: React.Dispatch<React.SetStateAction<Partial<PlantTraits>>>
  dimensions: Partial<PlantDimensions>
  setDimensions: React.Dispatch<React.SetStateAction<Partial<PlantDimensions>>>
  phenology: Partial<PlantPhenology>
  setPhenology: React.Dispatch<React.SetStateAction<Partial<PlantPhenology>>>
  environment: Partial<PlantEnvironment>
  setEnvironment: React.Dispatch<React.SetStateAction<Partial<PlantEnvironment>>>
  care: Partial<PlantCare>
  setCare: React.Dispatch<React.SetStateAction<Partial<PlantCare>>>
  propagation: Partial<PlantPropagation>
  setPropagation: React.Dispatch<React.SetStateAction<Partial<PlantPropagation>>>
  usage: Partial<PlantUsage>
  setUsage: React.Dispatch<React.SetStateAction<Partial<PlantUsage>>>
  ecology: Partial<PlantEcology>
  setEcology: React.Dispatch<React.SetStateAction<Partial<PlantEcology>>>
  commerce: Partial<PlantCommerce>
  setCommerce: React.Dispatch<React.SetStateAction<Partial<PlantCommerce>>>
  problems: Partial<PlantProblems>
  setProblems: React.Dispatch<React.SetStateAction<Partial<PlantProblems>>>
  planting: Partial<PlantPlanting>
  setPlanting: React.Dispatch<React.SetStateAction<Partial<PlantPlanting>>>
  meta: Partial<PlantMeta>
  setMeta: React.Dispatch<React.SetStateAction<Partial<PlantMeta>>>
}

export const CompleteAdvancedForm: React.FC<CompleteAdvancedFormProps> = ({
  classification,
  setClassification,
  focusClassificationTabSignal,
  identifiers,
  setIdentifiers,
  traits,
  setTraits,
  dimensions,
  setDimensions,
  phenology,
  setPhenology,
  environment,
  setEnvironment,
  care,
  setCare,
  propagation,
  setPropagation,
  usage,
  setUsage,
  ecology,
  setEcology,
  commerce,
  setCommerce,
  problems,
  setProblems,
  planting,
  setPlanting,
  meta,
  setMeta,
}) => {
  const selectedType = classification?.type
  const availableSubclassOptions = selectedType ? PLANT_SUBCLASS_OPTIONS[selectedType] || [] : []
  const selectedSubclass = classification?.subclass
  const availableSubSubclassOptions = selectedSubclass ? PLANT_SUBSUBCLASS_OPTIONS[selectedSubclass] || [] : []
  const selectedActivities = classification?.activities || []
  const selectedSubActivities = classification?.subActivities || {}
  const [activeTab, setActiveTab] = React.useState<'classification' | 'details'>('classification')
  const tabOptions: Array<{ id: 'classification' | 'details'; label: string }> = [
    { id: 'classification', label: 'Classification' },
    { id: 'details', label: 'Details' },
  ]

  React.useEffect(() => {
    if (typeof focusClassificationTabSignal === 'number') {
      setActiveTab('classification')
    }
  }, [focusClassificationTabSignal])

  const updateClassification = (mutator: (draft: Partial<PlantClassification>) => void) => {
    setClassification((prev) => {
      const draft = { ...(prev ?? {}) }
      mutator(draft)
      return draft
    })
  }

  const handleActivitiesChange = (nextValues: string[]) => {
    const typedValues = nextValues.filter(Boolean) as PlantActivityValue[]
    updateClassification((draft) => {
      if (typedValues.length > 0) {
        draft.activities = typedValues
      } else {
        delete draft.activities
      }
      if (draft.subActivities) {
        const cleaned: Partial<Record<PlantActivityValue, PlantSubActivityValue[]>> = {}
        for (const [activity, entries] of Object.entries(draft.subActivities)) {
          if (typedValues.includes(activity as PlantActivityValue)) {
            cleaned[activity as PlantActivityValue] = entries as PlantSubActivityValue[]
          }
        }
        draft.subActivities = Object.keys(cleaned).length > 0 ? cleaned : undefined
      }
    })
  }

  const handleSubActivitiesChange = (activity: PlantActivityValue, values: string[]) => {
    const typedValues = values.filter(Boolean)
    updateClassification((draft) => {
      const existing: Partial<Record<PlantActivityValue, PlantSubActivityValue[]>> = draft.subActivities ? { ...draft.subActivities } : {}
      if (typedValues.length === 0) {
        delete existing[activity]
      } else {
        existing[activity] = typedValues as PlantSubActivityValue[]
      }
      draft.subActivities = Object.keys(existing).length > 0 ? existing : undefined
    })
  }

  const classificationSection = (
    <CollapsibleSection title="Classification" defaultOpen>
      <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              className={selectBaseClass}
              value={selectedType || ''}
              onChange={(e) => {
              const nextValue = e.target.value as PlantClassification["type"] | ''
              updateClassification((draft) => {
                if (nextValue) {
                  draft.type = nextValue as PlantClassification["type"]
                } else {
                  delete draft.type
                }
                if (nextValue !== 'plant') {
                  delete draft.subclass
                  delete draft.subSubclass
                }
              })
            }}
            >
            <option value="">Select...</option>
            {PLANT_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {formatClassificationLabel(opt)}
              </option>
            ))}
            </Select>
          <p className="text-xs opacity-70">A plant can only belong to one type at a time.</p>
        </div>
        <div className="grid gap-2">
          <Label>Subclass (type-specific)</Label>
            <Select
              className={selectBaseClass}
              value={selectedSubclass || ''}
              onChange={(e) => {
              const nextValue = e.target.value as PlantClassification["subclass"] | ''
              updateClassification((draft) => {
                if (nextValue) {
                  draft.subclass = nextValue as PlantClassification["subclass"]
                } else {
                  delete draft.subclass
                }
                if (nextValue !== 'vegetable') {
                  delete draft.subSubclass
                }
              })
            }}
            disabled={(selectedType || '') !== 'plant'}
            >
            <option value="">Select...</option>
            {availableSubclassOptions.map((opt) => (
              <option key={opt} value={opt}>
                {formatClassificationLabel(opt)}
              </option>
            ))}
            </Select>
        </div>
        {availableSubSubclassOptions.length > 0 && (
          <div className="grid gap-2">
            <Label>Sub-subclass</Label>
              <Select
                className={selectBaseClass}
                value={classification?.subSubclass || ''}
                onChange={(e) => {
                const nextValue = e.target.value as PlantClassification["subSubclass"] | ''
                updateClassification((draft) => {
                  if (nextValue) {
                    draft.subSubclass = nextValue as PlantClassification["subSubclass"]
                  } else {
                    delete draft.subSubclass
                  }
                })
              }}
              >
              <option value="">Select...</option>
              {availableSubSubclassOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {formatClassificationLabel(opt)}
                </option>
              ))}
              </Select>
          </div>
        )}
        <MultiSelectButtons
          label="Activities"
          values={selectedActivities}
          options={PLANT_ACTIVITY_OPTIONS}
          onChange={handleActivitiesChange}
        />
        {selectedActivities.map((activity) => {
          const options = PLANT_SUBACTIVITY_OPTIONS[activity]
          if (!options || options.length === 0) {
            return null
          }
          return (
            <MultiSelectButtons
              key={activity}
              label={`Subactivity — ${formatClassificationLabel(activity)}`}
              values={(selectedSubActivities[activity] as PlantSubActivityValue[] | undefined) || []}
              options={options}
              onChange={(values) => handleSubActivitiesChange(activity, values)}
            />
          )
        })}
      </div>
    </CollapsibleSection>
  )

  const detailSections = (
    <>
      {/* Identifiers */}
      <CollapsibleSection title="Identifiers">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Scientific Name</Label>
            <Input
              value={identifiers?.scientificName || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, scientificName: e.target.value || undefined })}
              placeholder="Genus species"
            />
          </div>
          <div className="grid gap-2">
            <Label>Canonical Name</Label>
            <Input
              value={identifiers?.canonicalName || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, canonicalName: e.target.value || undefined })}
            />
          </div>
          <ArrayInputField
            label="Synonyms"
            values={identifiers?.synonyms || []}
            onChange={(synonyms) => setIdentifiers({ ...identifiers, synonyms })}
          />
          <ArrayInputField
            label="Common Names"
            values={identifiers?.commonNames || []}
            onChange={(commonNames) => setIdentifiers({ ...identifiers, commonNames })}
          />
            <div className="grid gap-2">
              <Label>Taxon Rank</Label>
              <Select
                className={selectBaseClass}
                value={identifiers?.taxonRank || ''}
                onChange={(e) => setIdentifiers({ ...identifiers, taxonRank: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['species', 'subspecies', 'variety', 'form', 'cultivar', 'hybrid'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
          <div className="grid gap-2">
            <Label>Cultivar Group</Label>
            <Input
              value={identifiers?.cultivarGroup || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, cultivarGroup: e.target.value || undefined })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Cultivar</Label>
            <Input
              value={identifiers?.cultivar || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, cultivar: e.target.value || undefined })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Family</Label>
            <Input
              value={identifiers?.family || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, family: e.target.value || undefined })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Genus</Label>
            <Input
              value={identifiers?.genus || ''}
              onChange={(e) => setIdentifiers({ ...identifiers, genus: e.target.value || undefined })}
            />
          </div>
          <div className="grid gap-2">
            <Label>External IDs</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="GBIF" value={typeof identifiers?.externalIds?.gbif === 'string' ? identifiers.externalIds.gbif : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.gbif = val
                else delete next.gbif
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              <Input placeholder="POWO" value={typeof identifiers?.externalIds?.powo === 'string' ? identifiers.externalIds.powo : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.powo = val
                else delete next.powo
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              <Input placeholder="IPNI" value={typeof identifiers?.externalIds?.ipni === 'string' ? identifiers.externalIds.ipni : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.ipni = val
                else delete next.ipni
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              <Input placeholder="ITIS" value={typeof identifiers?.externalIds?.itis === 'string' ? identifiers.externalIds.itis : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.itis = val
                else delete next.itis
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              <Input placeholder="Wikipedia URL" value={typeof identifiers?.externalIds?.wiki === 'string' ? identifiers.externalIds.wiki : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.wiki = val
                else delete next.wiki
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              <Input placeholder="Kindwise" value={typeof identifiers?.externalIds?.kindwise === 'string' ? identifiers.externalIds.kindwise : ''} onChange={(e) => {
                const next = { ...(identifiers?.externalIds || {}) }
                const val = e.target.value
                if (val) next.kindwise = val
                else delete next.kindwise
                setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
              }} />
              </div>
              <KeyValueList
                label="Other IDs"
                keyPlaceholder="Provider"
                valuePlaceholder="Reference"
                entries={identifiers?.externalIds?.other as Record<string, string> | undefined}
                onChange={(other) => {
                  const next = { ...(identifiers?.externalIds || {}) }
                  if (other && Object.keys(other).length > 0) {
                    next.other = other
                  } else {
                    delete next.other
                  }
                  setIdentifiers({ ...identifiers, externalIds: Object.keys(next).length ? next : undefined })
                }}
              />
          </div>
        </div>
      </CollapsibleSection>

      {/* Traits */}
      <CollapsibleSection title="Traits">
        <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Life Cycle</Label>
              <Select
                className={selectBaseClass}
                value={traits?.lifeCycle || ''}
                onChange={(e) => setTraits({ ...traits, lifeCycle: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['annual', 'biennial', 'perennial'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <MultiSelectButtons
            label="Habit"
            values={traits?.habit || []}
            options={['tree', 'shrub', 'vine', 'climber', 'herbaceous', 'succulent', 'grass', 'fern', 'aquatic'] as const}
            onChange={(habit) => setTraits({ ...traits, habit: habit as any })}
          />
            <div className="grid gap-2">
              <Label>Deciduous/Evergreen</Label>
              <Select
                className={selectBaseClass}
                value={traits?.deciduousEvergreen || ''}
                onChange={(e) => setTraits({ ...traits, deciduousEvergreen: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['deciduous', 'evergreen', 'semi-evergreen'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Growth Rate</Label>
              <Select
                className={selectBaseClass}
                value={traits?.growthRate || ''}
                onChange={(e) => setTraits({ ...traits, growthRate: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['slow', 'moderate', 'fast'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={traits?.thornsSpines || false} onChange={(e) => setTraits({ ...traits, thornsSpines: e.target.checked || undefined })} />
            <Label>Thorns/Spines</Label>
          </div>
            <div className="grid gap-2">
              <Label>Fragrance</Label>
              <Select
                className={selectBaseClass}
                value={traits?.fragrance || ''}
                onChange={(e) => setTraits({ ...traits, fragrance: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['none', 'light', 'moderate', 'strong'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={traits?.dogFriendly || false}
              onChange={(e) => setTraits({ ...traits, dogFriendly: e.target.checked || undefined })}
            />
            Dog friendly
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={traits?.catFriendly || false}
              onChange={(e) => setTraits({ ...traits, catFriendly: e.target.checked || undefined })}
            />
            Cat friendly
          </label>
        </div>
          <div className="grid gap-2">
            <Label>Toxicity</Label>
            <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">To Humans</Label>
                  <Select
                    className={selectBaseClass}
                    value={traits?.toxicity?.toHumans || ''}
                    onChange={(e) => setTraits({ ...traits, toxicity: { ...traits?.toxicity, toHumans: e.target.value as any || undefined } })}
                  >
                    <option value="">Select...</option>
                    {['non-toxic', 'mild', 'moderate', 'severe'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">To Pets</Label>
                  <Select
                    className={selectBaseClass}
                    value={traits?.toxicity?.toPets || ''}
                    onChange={(e) => setTraits({ ...traits, toxicity: { ...traits?.toxicity, toPets: e.target.value as any || undefined } })}
                  >
                    <option value="">Select...</option>
                    {['non-toxic', 'mild', 'moderate', 'severe'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Allergenicity</Label>
              <Select
                className={selectBaseClass}
                value={traits?.allergenicity || ''}
                onChange={(e) => setTraits({ ...traits, allergenicity: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['low', 'medium', 'high'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
          </div>
          <div className="grid gap-2">
            <Label>Invasiveness Status</Label>
              <Select
                className={selectBaseClass}
                value={traits?.invasiveness?.status || ''}
                onChange={(e) => setTraits({ ...traits, invasiveness: { ...traits?.invasiveness, status: e.target.value as any || undefined } })}
              >
                <option value="">Select...</option>
                {['not invasive', 'regional risk', 'invasive'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
          </div>
          <ArrayInputField
            label="Invasive Regions"
            values={traits?.invasiveness?.regions || []}
            onChange={(regions) => setTraits({ ...traits, invasiveness: { ...traits?.invasiveness, regions } })}
          />
        </div>
      </CollapsibleSection>

      {/* Dimensions */}
      <CollapsibleSection title="Dimensions">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Height (cm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={dimensions?.height?.minCm || ''} onChange={(e) => setDimensions({ ...dimensions, height: { ...dimensions?.height, minCm: e.target.value ? Number(e.target.value) : undefined } })} />
              <Input type="number" placeholder="Max" value={dimensions?.height?.maxCm || ''} onChange={(e) => setDimensions({ ...dimensions, height: { ...dimensions?.height, maxCm: e.target.value ? Number(e.target.value) : undefined } })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Spread (cm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={dimensions?.spread?.minCm || ''} onChange={(e) => setDimensions({ ...dimensions, spread: { ...dimensions?.spread, minCm: e.target.value ? Number(e.target.value) : undefined } })} />
              <Input type="number" placeholder="Max" value={dimensions?.spread?.maxCm || ''} onChange={(e) => setDimensions({ ...dimensions, spread: { ...dimensions?.spread, maxCm: e.target.value ? Number(e.target.value) : undefined } })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Spacing (cm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Row" value={dimensions?.spacing?.rowCm || ''} onChange={(e) => setDimensions({ ...dimensions, spacing: { ...dimensions?.spacing, rowCm: e.target.value ? Number(e.target.value) : undefined } })} />
              <Input type="number" placeholder="Plant" value={dimensions?.spacing?.plantCm || ''} onChange={(e) => setDimensions({ ...dimensions, spacing: { ...dimensions?.spacing, plantCm: e.target.value ? Number(e.target.value) : undefined } })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={dimensions?.containerFriendly || false} onChange={(e) => setDimensions({ ...dimensions, containerFriendly: e.target.checked || undefined })} />
            <Label>Container Friendly</Label>
          </div>
        </div>
      </CollapsibleSection>

      {/* Phenology */}
      <CollapsibleSection title="Phenology">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Flower Colors</Label>
            <div className="space-y-2">
              {(phenology?.flowerColors ?? []).map((color, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={color.name}
                    onChange={(e) => {
                      const newColors = [...(phenology?.flowerColors ?? [])]
                      newColors[idx] = { ...color, name: e.target.value }
                      setPhenology({ ...phenology, flowerColors: newColors })
                    }}
                    placeholder="Color name"
                  />
                  <Input
                    value={color.hex || ''}
                    onChange={(e) => {
                      const newColors = [...(phenology?.flowerColors ?? [])]
                      newColors[idx] = { ...color, hex: e.target.value || undefined }
                      setPhenology({ ...phenology, flowerColors: newColors })
                    }}
                    placeholder="#FFFFFF"
                    className="w-24"
                  />
                  <Button type="button" onClick={() => setPhenology({ ...phenology, flowerColors: (phenology?.flowerColors ?? []).filter((_color, i) => i !== idx) })}>Remove</Button>
                </div>
              ))}
              <Button type="button" onClick={() => setPhenology({ ...phenology, flowerColors: [...(phenology?.flowerColors ?? []), { name: '' }] })}>Add Color</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Leaf Colors</Label>
            <div className="space-y-2">
              {(phenology?.leafColors ?? []).map((color, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={color.name}
                    onChange={(e) => {
                      const newColors = [...(phenology?.leafColors ?? [])]
                      newColors[idx] = { ...color, name: e.target.value }
                      setPhenology({ ...phenology, leafColors: newColors })
                    }}
                    placeholder="Color name"
                  />
                  <Input
                    value={color.hex || ''}
                    onChange={(e) => {
                      const newColors = [...(phenology?.leafColors ?? [])]
                      newColors[idx] = { ...color, hex: e.target.value || undefined }
                      setPhenology({ ...phenology, leafColors: newColors })
                    }}
                    placeholder="#FFFFFF"
                    className="w-24"
                  />
                  <Button type="button" onClick={() => setPhenology({ ...phenology, leafColors: (phenology?.leafColors ?? []).filter((_color, i) => i !== idx) })}>Remove</Button>
                </div>
              ))}
              <Button type="button" onClick={() => setPhenology({ ...phenology, leafColors: [...(phenology?.leafColors ?? []), { name: '' }] })}>Add Color</Button>
            </div>
          </div>
          <MonthSelectorField
            label="Flowering Months"
            values={phenology?.floweringMonths || []}
            onChange={(floweringMonths) => setPhenology({ ...phenology, floweringMonths })}
          />
          <MonthSelectorField
            label="Fruiting Months"
            values={phenology?.fruitingMonths || []}
            onChange={(fruitingMonths) => setPhenology({ ...phenology, fruitingMonths })}
          />
          <ArrayInputField
            label="Scent Notes"
            values={phenology?.scentNotes || []}
            onChange={(scentNotes) => setPhenology({ ...phenology, scentNotes })}
          />
        </div>
      </CollapsibleSection>

      {/* Environment - continuing with remaining sections... */}
      {/* Due to length constraints, I'll create the remaining sections in a follow-up file or continue in the next message */}
      
      {/* For now, let me add placeholders for the remaining sections */}
      <CollapsibleSection title="Environment">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Sun Exposure</Label>
            <Select
              className={selectBaseClass}
              value={environment?.sunExposure || ''}
              onChange={(e) => setEnvironment({ ...environment, sunExposure: e.target.value as any || undefined })}
            >
              <option value="">Select...</option>
              {['full sun', 'partial sun', 'partial shade', 'full shade'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Light Intensity</Label>
            <Select
              className={selectBaseClass}
              value={environment?.lightIntensity || ''}
              onChange={(e) => setEnvironment({ ...environment, lightIntensity: e.target.value as any || undefined })}
            >
              <option value="">Select...</option>
              {['very high', 'high', 'medium', 'low'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>
          <ArrayInputField
            label="USDA Zones"
            values={(environment?.hardiness?.usdaZones || []).map(String)}
            onChange={(zones) =>
              setEnvironment({
                ...environment,
                hardiness: {
                  ...environment?.hardiness,
                  usdaZones: zones.map((z) => Number(z)).filter((z) => !Number.isNaN(z)),
                },
              })
            }
          />
          <div className="grid gap-2">
            <Label>RHS Hardiness</Label>
            <Input value={environment?.hardiness?.rhsH || ''} onChange={(e) => setEnvironment({ ...environment, hardiness: { ...environment?.hardiness, rhsH: e.target.value || undefined } })} />
          </div>
          <MultiSelectButtons label="Climate Preference" values={environment?.climatePref || []} options={['tropical', 'subtropical', 'temperate', 'Mediterranean', 'arid', 'continental', 'oceanic'] as const} onChange={(climatePref) => setEnvironment({ ...environment, climatePref: climatePref as any })} />
          <div className="grid gap-2">
            <Label>Temperature (°C)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={environment?.temperature?.minC || ''} onChange={(e) => setEnvironment({ ...environment, temperature: { ...environment?.temperature, minC: e.target.value ? Number(e.target.value) : undefined } })} />
              <Input type="number" placeholder="Max" value={environment?.temperature?.maxC || ''} onChange={(e) => setEnvironment({ ...environment, temperature: { ...environment?.temperature, maxC: e.target.value ? Number(e.target.value) : undefined } })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Humidity Preference</Label>
            <Select
              className={selectBaseClass}
              value={environment?.humidityPref || ''}
              onChange={(e) => setEnvironment({ ...environment, humidityPref: e.target.value as any || undefined })}
            >
              <option value="">Select...</option>
              {['low', 'moderate', 'high'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Wind Tolerance</Label>
            <Select
              className={selectBaseClass}
              value={environment?.windTolerance || ''}
              onChange={(e) => setEnvironment({ ...environment, windTolerance: e.target.value as any || undefined })}
            >
              <option value="">Select...</option>
              {['low', 'moderate', 'high'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Soil</Label>
            <MultiSelectButtons label="Texture" values={environment?.soil?.texture || []} options={['sandy', 'loamy', 'silty', 'clayey'] as const} onChange={(texture) => setEnvironment({ ...environment, soil: { ...environment?.soil, texture: texture as any } })} />
            <div className="grid gap-2">
              <Label className="text-xs">Drainage</Label>
                <Select
                  className={selectBaseClass}
                  value={environment?.soil?.drainage || ''}
                  onChange={(e) => setEnvironment({ ...environment, soil: { ...environment?.soil, drainage: e.target.value as any || undefined } })}
                >
                  <option value="">Select...</option>
                  {['free-draining', 'moderate', 'poor'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Fertility</Label>
                <Select
                  className={selectBaseClass}
                  value={environment?.soil?.fertility || ''}
                  onChange={(e) => setEnvironment({ ...environment, soil: { ...environment?.soil, fertility: e.target.value as any || undefined } })}
                >
                  <option value="">Select...</option>
                  {['low', 'medium', 'high'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">pH Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.1" placeholder="Min" value={environment?.soil?.pH?.min || ''} onChange={(e) => setEnvironment({ ...environment, soil: { ...environment?.soil, pH: { ...environment?.soil?.pH, min: e.target.value ? Number(e.target.value) : undefined } } })} />
                <Input type="number" step="0.1" placeholder="Max" value={environment?.soil?.pH?.max || ''} onChange={(e) => setEnvironment({ ...environment, soil: { ...environment?.soil, pH: { ...environment?.soil?.pH, max: e.target.value ? Number(e.target.value) : undefined } } })} />
              </div>
            </div>
          </div>
        </div>
        </CollapsibleSection>

        {/* Care */}
        <CollapsibleSection title="Care">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Sunlight</Label>
              <Select
                className={selectBaseClass}
                value={care?.sunlight || ''}
                onChange={(e) => setCare({ ...care, sunlight: e.target.value || undefined })}
              >
                <option value="">Select...</option>
                {['Low', 'Medium', 'High', 'Full Sun', 'Partial Sun'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Water Level</Label>
              <Select
                className={selectBaseClass}
                value={care?.water || ''}
                onChange={(e) => setCare({ ...care, water: e.target.value || undefined })}
              >
                <option value="">Select...</option>
                {['Low', 'Medium', 'High'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Difficulty</Label>
              <Select
                className={selectBaseClass}
                value={care?.difficulty || ''}
                onChange={(e) => setCare({ ...care, difficulty: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['easy', 'moderate', 'advanced'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Maintenance Level</Label>
              <Select
                className={selectBaseClass}
                value={care?.maintenanceLevel || ''}
                onChange={(e) => setCare({ ...care, maintenanceLevel: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['low', 'medium', 'high'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <div className="grid gap-2">
            <Label>Watering</Label>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const freq = typeof care?.watering?.frequency === 'object' && care?.watering?.frequency !== null ? care.watering.frequency : {}
                  return (
                    <>
                      <Input placeholder="Winter frequency" value={(freq as any).winter || ''} onChange={(e) => setCare({ ...care, watering: { ...care?.watering, frequency: { ...(freq as any), winter: e.target.value || undefined } } })}/>
                      <Input placeholder="Spring frequency" value={(freq as any).spring || ''} onChange={(e) => setCare({ ...care, watering: { ...care?.watering, frequency: { ...(freq as any), spring: e.target.value || undefined } } })}/>
                      <Input placeholder="Summer frequency" value={(freq as any).summer || ''} onChange={(e) => setCare({ ...care, watering: { ...care?.watering, frequency: { ...(freq as any), summer: e.target.value || undefined } } })}/>
                      <Input placeholder="Autumn frequency" value={(freq as any).autumn || ''} onChange={(e) => setCare({ ...care, watering: { ...care?.watering, frequency: { ...(freq as any), autumn: e.target.value || undefined } } })}/>
                    </>
                  )
                })()}
              </div>
                <Select
                  className={selectBaseClass}
                  value={care?.watering?.method || ''}
                  onChange={(e) => setCare({ ...care, watering: { ...care?.watering, method: e.target.value as any || undefined } })}
                >
                  <option value="">Select method...</option>
                  {['at soil', 'bottom water', 'soak and dry', 'drip', 'none (aquatic)'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
              <Input type="number" placeholder="Depth (cm)" value={care?.watering?.depthCm || ''} onChange={(e) => setCare({ ...care, watering: { ...care?.watering, depthCm: e.target.value ? Number(e.target.value) : undefined } })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Fertilizing</Label>
              <Select
                className={selectBaseClass}
                value={care?.fertilizing?.type || ''}
                onChange={(e) => setCare({ ...care, fertilizing: { ...care?.fertilizing, type: e.target.value as any || undefined } })}
              >
                <option value="">Select type...</option>
                {['balanced NPK', 'high K', 'organic compost', 'slow-release', 'foliar'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            <Input placeholder="Schedule" value={care?.fertilizing?.schedule || ''} onChange={(e) => setCare({ ...care, fertilizing: { ...care?.fertilizing, schedule: e.target.value || undefined } })} />
          </div>
          <div className="grid gap-2">
            <Label>Pruning</Label>
            <MonthSelectorField values={care?.pruning?.bestMonths || []} onChange={(bestMonths) => setCare({ ...care, pruning: { ...care?.pruning, bestMonths } })} label="Best Months" />
              <Select
                className={selectBaseClass}
                value={care?.pruning?.method || ''}
                onChange={(e) => setCare({ ...care, pruning: { ...care?.pruning, method: e.target.value as any || undefined } })}
              >
                <option value="">Select method...</option>
                {['light trim', 'hard prune', 'deadheading', 'thinning', 'renewal'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
          </div>
          <div className="grid gap-2">
            <Label>Mulching</Label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={care?.mulching?.recommended || false} onChange={(e) => setCare({ ...care, mulching: { ...care?.mulching, recommended: e.target.checked || undefined } })} />
              <Label>Recommended</Label>
            </div>
            <Input placeholder="Material" value={care?.mulching?.material || ''} onChange={(e) => setCare({ ...care, mulching: { ...care?.mulching, material: e.target.value || undefined } })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={care?.stakingSupport || false} onChange={(e) => setCare({ ...care, stakingSupport: e.target.checked || undefined })} />
            <Label>Staking Support Needed</Label>
          </div>
          <div className="grid gap-2">
            <Label>Repotting Interval (years)</Label>
            <Input type="number" value={care?.repottingIntervalYears || ''} onChange={(e) => setCare({ ...care, repottingIntervalYears: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Propagation */}
      <CollapsibleSection title="Propagation">
        <div className="grid gap-4">
          <MultiSelectButtons label="Methods" values={propagation?.methods || []} options={['seed', 'cuttings', 'division', 'layering', 'grafting', 'tissue culture'] as const} onChange={(methods) => setPropagation({ ...propagation, methods: methods as any })} />
            <div className="grid gap-2">
              <Label>Seed Stratification</Label>
              <Select
                className={selectBaseClass}
                value={propagation?.seed?.stratification || ''}
                onChange={(e) => setPropagation({ ...propagation, seed: { ...propagation?.seed, stratification: e.target.value as any || undefined } })}
              >
                <option value="">Select...</option>
                {['none', 'cold-moist', 'warm', 'scarification'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <div className="grid gap-2">
            <Label>Germination Days</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min" value={propagation?.seed?.germinationDays?.min || ''} onChange={(e) => setPropagation({ ...propagation, seed: { ...propagation?.seed, germinationDays: { ...propagation?.seed?.germinationDays, min: e.target.value ? Number(e.target.value) : undefined } } })} />
              <Input type="number" placeholder="Max" value={propagation?.seed?.germinationDays?.max || ''} onChange={(e) => setPropagation({ ...propagation, seed: { ...propagation?.seed, germinationDays: { ...propagation?.seed?.germinationDays, max: e.target.value ? Number(e.target.value) : undefined } } })} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Usage */}
      <CollapsibleSection title="Usage">
        <div className="grid gap-4">
          <MultiSelectButtons label="Garden Uses" values={usage?.gardenUses || []} options={['border', 'mass planting', 'hedge', 'groundcover', 'specimen', 'container', 'climber', 'wildlife garden', 'cut flower', 'fragrance'] as const} onChange={(gardenUses) => setUsage({ ...usage, gardenUses: gardenUses as any })} />
            <div className="grid gap-2">
              <Label>Indoor/Outdoor</Label>
              <Select
                className={selectBaseClass}
                value={usage?.indoorOutdoor || ''}
                onChange={(e) => setUsage({ ...usage, indoorOutdoor: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['outdoor', 'indoor', 'both'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <MultiSelectButtons label="Edible Parts" values={usage?.edibleParts || []} options={['none', 'leaf', 'flower', 'fruit', 'seed', 'root', 'stem'] as const} onChange={(edibleParts) => setUsage({ ...usage, edibleParts: edibleParts as any })} />
          <ArrayInputField label="Culinary Uses" values={usage?.culinaryUses || []} onChange={(culinaryUses) => setUsage({ ...usage, culinaryUses })} />
          <ArrayInputField label="Medicinal Uses" values={usage?.medicinalUses || []} onChange={(medicinalUses) => setUsage({ ...usage, medicinalUses })} />
        </div>
      </CollapsibleSection>

      {/* Ecology */}
      <CollapsibleSection title="Ecology">
        <div className="grid gap-4">
          <ArrayInputField label="Native Range" values={ecology?.nativeRange || []} onChange={(nativeRange) => setEcology({ ...ecology, nativeRange })} />
          <ArrayInputField label="Pollinators" values={ecology?.pollinators || []} onChange={(pollinators) => setEcology({ ...ecology, pollinators })} />
          <ArrayInputField label="Wildlife Value" values={ecology?.wildlifeValue || []} onChange={(wildlifeValue) => setEcology({ ...ecology, wildlifeValue })} />
            <div className="grid gap-2">
              <Label>Conservation Status</Label>
              <Select
                className={selectBaseClass}
                value={ecology?.conservationStatus || ''}
                onChange={(e) => setEcology({ ...ecology, conservationStatus: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['NE', 'DD', 'LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
        </div>
      </CollapsibleSection>

      {/* Commerce */}
      <CollapsibleSection title="Commerce">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={commerce?.seedsAvailable || false} onChange={(e) => setCommerce({ ...commerce, seedsAvailable: e.target.checked || undefined })} />
          <Label>Seeds Available</Label>
        </div>
      </CollapsibleSection>

      {/* Problems */}
      <CollapsibleSection title="Problems">
        <div className="grid gap-4">
          <ArrayInputField label="Pests" values={problems?.pests || []} onChange={(pests) => setProblems({ ...problems, pests })} />
          <ArrayInputField label="Diseases" values={problems?.diseases || []} onChange={(diseases) => setProblems({ ...problems, diseases })} />
          <ArrayInputField label="Hazards" values={problems?.hazards || []} onChange={(hazards) => setProblems({ ...problems, hazards })} />
        </div>
      </CollapsibleSection>

      {/* Planting */}
      <CollapsibleSection title="Planting">
        <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Calendar</Label>
              <Select
                className={selectBaseClass}
                value={planting?.calendar?.hemisphere || ''}
                onChange={(e) => setPlanting({ ...planting, calendar: { ...planting?.calendar, hemisphere: e.target.value as any || undefined } })}
              >
                <option value="">Select hemisphere...</option>
                {['north', 'south', 'equatorial'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            <MonthSelectorField label="Sowing Months" values={planting?.calendar?.sowingMonths || []} onChange={(sowingMonths) => setPlanting({ ...planting, calendar: { ...planting?.calendar, sowingMonths } })} />
            <MonthSelectorField label="Planting Out Months" values={planting?.calendar?.plantingOutMonths || []} onChange={(plantingOutMonths) => setPlanting({ ...planting, calendar: { ...planting?.calendar, plantingOutMonths } })} />
              <div className="grid gap-2">
                <Label>Featured Month</Label>
                <Select
                  className={selectBaseClass}
                  value={planting?.calendar?.promotionMonth ?? ''}
                  onChange={(e) => setPlanting({ ...planting, calendar: { ...planting?.calendar, promotionMonth: e.target.value ? Number(e.target.value) : undefined } })}
                >
                  <option value="">Select...</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]}</option>)}
                </Select>
              </div>
          </div>
          <ArrayInputField label="Site Preparation" values={planting?.sitePrep || []} onChange={(sitePrep) => setPlanting({ ...planting, sitePrep })} />
          <ArrayInputField label="Companion Plants" values={planting?.companionPlants || []} onChange={(companionPlants) => setPlanting({ ...planting, companionPlants })} />
          <ArrayInputField label="Avoid Near" values={planting?.avoidNear || []} onChange={(avoidNear) => setPlanting({ ...planting, avoidNear })} />
        </div>
      </CollapsibleSection>

      {/* Meta */}
      <CollapsibleSection title="Meta">
        <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Rarity</Label>
              <Select
                className={selectBaseClass}
                value={meta?.rarity || ''}
                onChange={(e) => setMeta({ ...meta, rarity: e.target.value as any || undefined })}
              >
                <option value="">Select...</option>
                {['common', 'uncommon', 'rare', 'very rare'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          <ArrayInputField label="Tags" values={meta?.tags || []} onChange={(tags) => setMeta({ ...meta, tags })} />
            <div className="grid gap-2">
              <Label>Fun Fact</Label>
              <Textarea
                value={meta?.funFact || ''}
                onChange={(e) => setMeta({ ...meta, funFact: e.target.value || undefined })}
                placeholder="Share an unexpected detail most people don't know about this plant"
              />
              <p className="text-xs text-muted-foreground">
                Think rare anecdotes, record-breaking traits, or surprising botanical lore.
              </p>
            </div>
          <ArrayInputField label="Source References" values={meta?.sourceReferences || []} onChange={(sourceReferences) => setMeta({ ...meta, sourceReferences })} />
          <div className="grid gap-2">
            <Label>Author Notes</Label>
            <Textarea value={meta?.authorNotes || ''} onChange={(e) => setMeta({ ...meta, authorNotes: e.target.value || undefined })} placeholder="Personal notes and observations" />
          </div>
        </div>
        </CollapsibleSection>
      </>
    )

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200/70 bg-white/80 p-2 dark:border-[#3e3e42]/70 dark:bg-[#1e1e1e]">
          {tabOptions.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-transparent text-stone-600 dark:text-stone-300 hover:bg-stone-100/70 dark:hover:bg-[#2d2d30]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'classification' ? classificationSection : detailSections}
      </div>
    )
  }
