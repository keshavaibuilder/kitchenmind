import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'

export const MemoryService = {
  /**
   * Loads all memories for a household (active & disabled, excluding deleted).
   */
  async loadMemories(householdId) {
    if (!householdId) return []
    try {
      const { data, error } = await supabaseClient
        .from('copilot_memory')
        .select('*')
        .eq('household_id', householdId)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      const norm = normalizeError(err, 'MemoryService.loadMemories')
      console.warn('[MemoryService] Failed to load memories:', norm.message)
      return []
    }
  },

  /**
   * Loads active, non-expired memories for context assembly & retrieval.
   */
  async getActiveMemories(householdId) {
    if (!householdId) return []
    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabaseClient
        .from('copilot_memory')
        .select('*')
        .eq('household_id', householdId)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      const norm = normalizeError(err, 'MemoryService.getActiveMemories')
      console.warn('[MemoryService] Failed to load active memories:', norm.message)
      return []
    }
  },

  /**
   * Saves or creates an explicit Copilot memory.
   */
  async saveMemory(householdId, { memoryType = 'preference', memoryKey, memoryValue, source = 'user_explicit', expiresAt = null }) {
    if (!householdId) throw new Error('Missing household_id for saveMemory')
    if (!memoryKey || !memoryValue) throw new Error('Missing memoryKey or memoryValue')

    try {
      // Check if memory with key exists
      const { data: existing } = await supabaseClient
        .from('copilot_memory')
        .select('id')
        .eq('household_id', householdId)
        .eq('memory_key', memoryKey)
        .neq('status', 'deleted')
        .maybeSingle()

      if (existing) {
        const { data, error } = await supabaseClient
          .from('copilot_memory')
          .update({
            memory_type: memoryType,
            memory_value: memoryValue,
            source,
            status: 'active',
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('household_id', householdId)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        const { data, error } = await supabaseClient
          .from('copilot_memory')
          .insert({
            household_id: householdId,
            memory_type: memoryType,
            memory_key: memoryKey,
            memory_value: memoryValue,
            source,
            confidence: 1.0,
            status: 'active',
            expires_at: expiresAt,
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (err) {
      throw normalizeError(err, 'MemoryService.saveMemory')
    }
  },

  /**
   * Updates an existing memory entry.
   */
  async updateMemory(householdId, memoryId, updates) {
    if (!householdId || !memoryId) throw new Error('Missing householdId or memoryId')
    try {
      const { data, error } = await supabaseClient
        .from('copilot_memory')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('household_id', householdId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      throw normalizeError(err, 'MemoryService.updateMemory')
    }
  },

  /**
   * Changes status of a memory ('active', 'disabled', 'deleted').
   */
  async setMemoryStatus(householdId, memoryId, status) {
    if (!householdId || !memoryId) throw new Error('Missing householdId or memoryId')
    try {
      const { data, error } = await supabaseClient
        .from('copilot_memory')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('household_id', householdId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      throw normalizeError(err, 'MemoryService.setMemoryStatus')
    }
  },

  /**
   * Deletes a memory (soft-delete to 'deleted' status).
   */
  async deleteMemory(householdId, memoryId) {
    return this.setMemoryStatus(householdId, memoryId, 'deleted')
  },

  /**
   * Clears all memories for a household.
   */
  async clearAllMemories(householdId) {
    if (!householdId) throw new Error('Missing household_id for clearAllMemories')
    try {
      const { error } = await supabaseClient
        .from('copilot_memory')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('household_id', householdId)

      if (error) throw error
      return true
    } catch (err) {
      throw normalizeError(err, 'MemoryService.clearAllMemories')
    }
  },
}
