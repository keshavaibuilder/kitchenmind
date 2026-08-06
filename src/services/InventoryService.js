import { supabaseClient } from './supabaseClient'
import { normalizeError } from '@/utils/errors'

/**
 * InventoryService
 * Framework-agnostic inventory management service.
 * Standardized error handling and plain JS object returns.
 */
export const InventoryService = {
  /**
   * Retrieves all inventory items for a household.
   * Type: Simple CRUD
   * @param {string} householdId 
   * @returns {Promise<Array<Object>>}
   */
  async getInventory(householdId) {
    if (!householdId) return []
    try {
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('*')
        .eq('household_id', householdId)

      if (error) {
        throw normalizeError(error, 'INVENTORY_FETCH_FAILED')
      }

      return data ?? []
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_FETCH_FAILED')
    }
  },

  /**
   * Finds an inventory item by canonical name.
   * Type: Simple CRUD
   * @param {string} householdId 
   * @param {string} canonicalName 
   * @returns {Promise<Object|null>}
   */
  async getItemByCanonicalName(householdId, canonicalName) {
    if (!householdId || !canonicalName) return null
    try {
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('id, quantity_grams, canonical_name')
        .eq('household_id', householdId)
        .ilike('canonical_name', canonicalName)
        .maybeSingle()

      if (error) {
        throw normalizeError(error, 'INVENTORY_ITEM_LOOKUP_FAILED')
      }

      return data ?? null
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_ITEM_LOOKUP_FAILED')
    }
  },

  /**
   * Adds or updates (upserts) an item by checking canonical name.
   * Type: Business Transaction
   * Target for Future Migration: PostgreSQL RPC or Supabase Edge Function to atomically update quantity or insert new item.
   * 
   * @param {string} householdId 
   * @param {Object} itemPayload - { label, canonical, category, gramsToStore, displayUnit, threshold }
   * @returns {Promise<Object>}
   */
  async addOrUpdateItem(householdId, { label, canonical, category, gramsToStore, displayUnit, threshold }) {
    if (!householdId) throw normalizeError('Missing household_id', 'INVENTORY_ADD_FAILED')
    try {
      const existing = await this.getItemByCanonicalName(householdId, canonical)

      if (existing) {
        const { data, error } = await supabaseClient
          .from('inventory')
          .update({
            quantity_grams: existing.quantity_grams + gramsToStore,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw normalizeError(error, 'INVENTORY_UPDATE_FAILED')
        return data
      } else {
        const { data, error } = await supabaseClient
          .from('inventory')
          .insert({
            household_id: householdId,
            item_name: label,
            canonical_name: canonical,
            category: category,
            quantity_grams: gramsToStore,
            display_unit: displayUnit,
            low_stock_threshold: threshold,
          })
          .select()
          .single()

        if (error) throw normalizeError(error, 'INVENTORY_INSERT_FAILED')
        return data
      }
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_ADD_FAILED')
    }
  },

  /**
   * Updates an existing inventory item by ID.
   * Type: Simple CRUD
   * @param {string} itemId 
   * @param {Object} updates 
   * @returns {Promise<Object>}
   */
  async updateItem(itemId, updates) {
    if (!itemId) throw normalizeError('Missing item ID', 'INVENTORY_UPDATE_FAILED')
    try {
      const { data, error } = await supabaseClient
        .from('inventory')
        .update({
          ...updates,
          last_updated: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single()

      if (error) throw normalizeError(error, 'INVENTORY_UPDATE_FAILED')
      return data
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_UPDATE_FAILED')
    }
  },

  /**
   * Deletes an inventory item by ID.
   * Type: Simple CRUD
   * @param {string} itemId 
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteItem(itemId) {
    if (!itemId) throw normalizeError('Missing item ID', 'INVENTORY_DELETE_FAILED')
    try {
      const { error } = await supabaseClient
        .from('inventory')
        .delete()
        .eq('id', itemId)

      if (error) throw normalizeError(error, 'INVENTORY_DELETE_FAILED')
      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_DELETE_FAILED')
    }
  },
}
