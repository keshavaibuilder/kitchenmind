import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'

/**
 * HouseholdService
 * Framework-agnostic service for managing households, members, and preferences.
 * Standardized error handling and plain JS object returns.
 */
export const HouseholdService = {
  /**
   * Resolves household ID for a given user ID.
   * Type: Simple CRUD
   * @param {string} userId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why. Used by the AI Copilot Edge Function to resolve
   *   household_id from the verified session's user id, per-request.
   * @returns {Promise<string|null>} household_id or null
   */
  async getHouseholdIdByUserId(userId, client = supabaseClient) {
    if (!userId) return null
    try {
      const { data, error } = await client
        .from('members')
        .select('household_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        throw normalizeError(error, 'HOUSEHOLD_LOOKUP_FAILED')
      }

      return data?.household_id ?? null
    } catch (err) {
      throw normalizeError(err, 'HOUSEHOLD_LOOKUP_FAILED')
    }
  },

  /**
   * Retrieves household profile by ID.
   * Type: Simple CRUD
   * @param {string} householdId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<Object|null>} Plain household object
   */
  async getHouseholdDetails(householdId, client = supabaseClient) {
    if (!householdId) return null
    try {
      const { data, error } = await client
        .from('household')
        .select('*')
        .eq('id', householdId)
        .single()

      if (error) {
        throw normalizeError(error, 'HOUSEHOLD_FETCH_FAILED')
      }

      return data ?? null
    } catch (err) {
      throw normalizeError(err, 'HOUSEHOLD_FETCH_FAILED')
    }
  },

  /**
   * Retrieves all members of a household (used by rotiCalculator for flour requirement scaling).
   * Type: Simple CRUD
   * @param {string} householdId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<Array<Object>>}
   */
  async getMembers(householdId, client = supabaseClient) {
    if (!householdId) return []
    try {
      const { data, error } = await client.from('members').select('*').eq('household_id', householdId)
      if (error) throw normalizeError(error, 'MEMBERS_FETCH_FAILED')
      return data ?? []
    } catch (err) {
      throw normalizeError(err, 'MEMBERS_FETCH_FAILED')
    }
  },

  /**
   * Retrieves preferences for a household.
   * Type: Simple CRUD
   * @param {string} householdId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<Object|null>} Plain preferences object
   */
  async getPreferences(householdId, client = supabaseClient) {
    if (!householdId) return null
    try {
      const { data, error } = await client
        .from('preferences')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle()

      if (error) {
        throw normalizeError(error, 'PREFERENCES_FETCH_FAILED')
      }

      return data ?? null
    } catch (err) {
      throw normalizeError(err, 'PREFERENCES_FETCH_FAILED')
    }
  },

  /**
   * Creates a household along with its initial members, preferences, and custom items.
   * Type: Business Transaction
   * Target for Future Migration: PostgreSQL RPC or Supabase Edge Function to guarantee atomic ACID transactions across multi-table inserts.
   * 
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {string} payload.householdName
   * @param {Object} payload.members - { adults, children, rotiPerAdult }
   * @param {Array<string>} [payload.breakfast]
   * @param {Array<string>} [payload.customBreakfast]
   * @param {Array<Object>} [payload.dalOrder]
   * @param {Array<string>} [payload.excludedVeg]
   * @param {Object} [payload.nonVeg] - { eatsNonVeg, days }
   * @param {Array<string>} [payload.fasting]
   * @param {Object} [payload.tiffin] - { tiffinDefault, box1, box2 }
   * @param {Array<string>} [payload.customTiffin]
   * @returns {Promise<{ household: Object, members: Array<Object>, preferences: Object }>}
   */
  async createHouseholdWithMembersAndPreferences({
    userId,
    householdName,
    members,
    breakfast = [],
    customBreakfast = [],
    dalOrder = [],
    excludedVeg = [],
    nonVeg = { eatsNonVeg: false, days: [] },
    fasting = [],
    tiffin = { tiffinDefault: 'none', box1: [], box2: [] },
    customTiffin = [],
  }) {
    try {
      // Step 1: Insert household
      const { data: household, error: hErr } = await supabaseClient
        .from('household')
        .insert({
          name: householdName.trim(),
          baseline_members: (members.adults || 0) + (members.children || 0),
          roti_per_adult: members.rotiPerAdult || 3,
          roti_per_child: 2,
        })
        .select()
        .single()

      if (hErr) throw normalizeError(hErr, 'HOUSEHOLD_CREATE_FAILED')

      // Step 2: Insert members
      const memberRows = []
      for (let i = 0; i < (members.adults || 0); i++) {
        memberRows.push({
          household_id: household.id,
          user_id: i === 0 ? userId : null,
          name: i === 0 ? 'You' : `Adult ${i + 1}`,
          role: 'adult',
          roti_preference: members.rotiPerAdult || 3,
        })
      }
      for (let i = 0; i < (members.children || 0); i++) {
        memberRows.push({
          household_id: household.id,
          user_id: null,
          name: `Child ${i + 1}`,
          role: 'child',
          roti_preference: 2,
        })
      }
      const { data: createdMembers, error: mErr } = await supabaseClient
        .from('members')
        .insert(memberRows)
        .select()

      if (mErr) throw normalizeError(mErr, 'MEMBERS_CREATE_FAILED')

      // Step 3: Insert preferences
      const { data: preferences, error: pErr } = await supabaseClient
        .from('preferences')
        .insert({
          household_id: household.id,
          breakfast_rotation: [...customBreakfast, ...breakfast],
          non_veg_days: nonVeg.eatsNonVeg ? nonVeg.days : [],
          fasting_days: fasting.includes('none') ? [] : fasting,
          dal_order: dalOrder.length
            ? dalOrder.map((d) => (typeof d === 'string' ? d : d.id))
            : ['masoor', 'toor', 'moong', 'chana', 'urad'],
          excluded_vegetables: excludedVeg,
          tiffin_default: tiffin.tiffinDefault ?? 'none',
          tiffin_boxes: tiffin.tiffinDefault === '2boxes' ? 2 : tiffin.tiffinDefault === '1box' ? 1 : 0,
          tiffin_box1_options: tiffin.box1 || [],
          tiffin_box2_options: tiffin.box2 || [],
        })
        .select()
        .single()

      if (pErr) throw normalizeError(pErr, 'PREFERENCES_CREATE_FAILED')

      // Step 4: Custom items (if any)
      const customRows = [
        ...customBreakfast.map((name) => ({
          household_id: household.id,
          name,
          meal_type: 'breakfast',
        })),
        ...customTiffin.map((name) => ({
          household_id: household.id,
          name,
          meal_type: 'tiffin',
        })),
      ]
      if (customRows.length > 0) {
        const { error: cErr } = await supabaseClient
          .from('custom_items')
          .insert(customRows)

        if (cErr) throw normalizeError(cErr, 'CUSTOM_ITEMS_CREATE_FAILED')
      }

      return {
        household,
        members: createdMembers,
        preferences,
      }
    } catch (err) {
      throw normalizeError(err, 'HOUSEHOLD_SETUP_FAILED')
    }
  },
}
