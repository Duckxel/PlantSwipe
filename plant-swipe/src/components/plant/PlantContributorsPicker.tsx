import React from 'react'
import { User, X, Users } from 'lucide-react'
import { SearchItem, type SearchItemOption } from '@/components/ui/search-item'
import { supabase } from '@/lib/supabaseClient'
import type { PlantContributor } from '@/types/plant'

interface Props {
  value: PlantContributor[]
  onChange: (next: PlantContributor[]) => void
}

const optionForContributor = (c: PlantContributor): SearchItemOption => ({
  id: c.id,
  label: c.name || 'Unknown',
  description: c.id,
  icon: <User className="h-4 w-4 text-stone-400 dark:text-stone-500" />,
})

/**
 * Multi-select user picker for plant contributors. Saves profile ids only —
 * display names are resolved from `profiles` at read time.
 */
export const PlantContributorsPicker: React.FC<Props> = ({ value, onChange }) => {
  const searchUsers = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    try {
      let q = supabase.from('profiles').select('id, display_name, avatar_url, is_admin').limit(20)
      if (query.trim()) q = q.ilike('display_name', `%${query.trim()}%`)
      const { data, error } = await q
      if (error) {
        console.warn('[PlantContributorsPicker] search failed', error.message)
        return []
      }
      return (data || []).map((u: any) => ({
        id: String(u.id),
        label: u.display_name || 'Unknown User',
        description: u.is_admin ? 'Admin' : u.id,
        icon: u.avatar_url
          ? <img src={u.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
          : <User className="h-4 w-4 text-stone-400 dark:text-stone-500" />,
      }))
    } catch (err) {
      console.warn('[PlantContributorsPicker] search threw', err)
      return []
    }
  }, [])

  const currentOptions = React.useMemo(() => value.map(optionForContributor), [value])
  const currentIds = React.useMemo(() => currentOptions.map((o) => o.id), [currentOptions])

  const handleMultiSelect = (options: SearchItemOption[]) => {
    onChange(options.map((opt) => ({ id: opt.id, name: opt.label || null })))
  }

  const removeAt = (idx: number) => {
    const next = value.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((c, idx) => (
            <span
              key={c.id + ':' + idx}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e20] px-2.5 py-1 text-xs"
              title={`profile ${c.id}`}
            >
              <User className="h-3 w-3 text-stone-500" />
              <span>{c.name || 'Unknown'}</span>
              <button
                type="button"
                aria-label={`Remove ${c.name || 'contributor'}`}
                className="ml-0.5 text-stone-400 hover:text-red-600 dark:hover:text-red-400"
                onClick={() => removeAt(idx)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          No contributors yet. Search and add users below.
        </div>
      )}
      <SearchItem
        multiSelect
        value={null}
        values={currentIds}
        selectedOptions={currentOptions}
        onSelect={() => {}}
        onMultiSelect={handleMultiSelect}
        onSearch={searchUsers}
        placeholder="Add contributor"
        title="Select contributors"
        description="Search users by display name. Their profile id will be saved."
        searchPlaceholder="Search users…"
        emptyMessage="No users found."
        confirmLabel="Confirm contributors"
      />
    </div>
  )
}

export default PlantContributorsPicker
