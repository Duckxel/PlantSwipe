import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"

export type TeamMember = {
  id: string
  name: string
  display_name: string
  role: string
  tag: string | null
  image_url: string | null
  user_id: string | null
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type UseTeamMembersResult = {
  teamMembers: TeamMember[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useTeamMembers(includeInactive = false): UseTeamMembersResult {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeamMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from("team_members")
        .select("*")
        .order("position", { ascending: true })

      if (!includeInactive) {
        query = query.eq("is_active", true)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      setTeamMembers(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch team members"
      setError(message)
      console.error("Error fetching team members:", err)
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    fetchTeamMembers()
  }, [fetchTeamMembers])

  return {
    teamMembers,
    loading,
    error,
    refetch: fetchTeamMembers,
  }
}

// Admin operations for team members
export type TeamMemberInput = {
  name: string
  display_name: string
  role: string
  tag?: string | null
  image_url?: string | null
  user_id?: string | null
  position?: number
  is_active?: boolean
}

export async function createTeamMember(input: TeamMemberInput): Promise<TeamMember> {
  const { data, error } = await supabase
    .from("team_members")
    .insert({
      name: input.name,
      display_name: input.display_name,
      role: input.role,
      tag: input.tag || null,
      image_url: input.image_url || null,
      user_id: input.user_id || null,
      position: input.position ?? 999,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function updateTeamMember(
  id: string,
  input: Partial<TeamMemberInput>
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from("team_members")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.display_name !== undefined && { display_name: input.display_name }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.tag !== undefined && { tag: input.tag }),
      ...(input.image_url !== undefined && { image_url: input.image_url }),
      ...(input.user_id !== undefined && { user_id: input.user_id }),
      ...(input.position !== undefined && { position: input.position }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function reorderTeamMembers(
  orderedIds: string[]
): Promise<void> {
  // Update positions in batch
  const updates = orderedIds.map((id, index) => ({
    id,
    position: index,
  }))

  for (const update of updates) {
    const { error } = await supabase
      .from("team_members")
      .update({ position: update.position })
      .eq("id", update.id)

    if (error) {
      throw new Error(error.message)
    }
  }
}
