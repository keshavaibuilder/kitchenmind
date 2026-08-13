import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'

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
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client, for
   *   per-request-scoped callers (e.g. the AI Copilot Edge Function) that must not share the
   *   browser's module-level singleton across concurrent households. Defaults to that singleton
   *   for every existing browser call site, which is unaffected by this parameter.
   * @returns {Promise<Array<Object>>}
   */
  async getInventory(householdId, client = supabaseClient) {
    if (!householdId) return []
    try {
      const { data, error } = await client
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
   * Active batches expiring within a window, joined to inventory for household scoping and
   * canonical_name — one query, not one per item. Used by the Kitchen Intelligence Dashboard's
   * Expiry Risk module.
   *
   * Note: no code path currently sets inventory_batches.expiry_date (commit_scanned_bill inserts
   * batches with expiry_date left NULL; there is no OCR expiry extraction or manual-entry UI for
   * it yet), so this will legitimately return an empty array until one of those exists — that's
   * a real "no data yet" state, not a bug in this query.
   *
   * @param {string} householdId
   * @param {{ withinDays?: number, client?: import('@supabase/supabase-js').SupabaseClient }} [options]
   * @returns {Promise<Array<Object>>}
   */
  async getExpiringBatches(householdId, { withinDays = 7, client = supabaseClient } = {}) {
    if (!householdId) return []
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + withinDays)
      const cutoffDate = cutoff.toISOString().slice(0, 10)

      const { data, error } = await client
        .from('inventory_batches')
        .select('id, remaining_grams, expiry_date, purchase_date, status, inventory!inner(id, household_id, canonical_name, category)')
        .eq('inventory.household_id', householdId)
        .eq('status', 'active')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', cutoffDate)
        .order('expiry_date', { ascending: true })

      if (error) {
        throw normalizeError(error, 'INVENTORY_EXPIRY_FETCH_FAILED')
      }

      return data ?? []
    } catch (err) {
      throw normalizeError(err, 'INVENTORY_EXPIRY_FETCH_FAILED')
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
      let inventoryRow

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
        inventoryRow = data
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
        inventoryRow = data
      }

      // Without a batch, this stock is invisible to mark_meal_cooked()'s FIFO deduction (it
      // only walks inventory_batches) — cooking a meal that uses this item would report a
      // false shortfall and never actually decrement quantity_grams. Mirrors the batch commit_
      // scanned_bill() already does per line item, just with bill_item_id/cost/expiry_date null
      // since a manual add has none of those.
      const { error: batchError } = await supabaseClient.from('inventory_batches').insert({
        inventory_id: inventoryRow.id,
        initial_grams: gramsToStore,
        remaining_grams: gramsToStore,
        status: 'active',
      })
      if (batchError) throw normalizeError(batchError, 'INVENTORY_BATCH_CREATE_FAILED')

      return inventoryRow
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
