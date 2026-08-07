import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * MealLogService
 * Meal lifecycle (PLANNED -> COOKED | SKIPPED) and the atomic, FIFO-aware stock deduction
 * that happens when a meal transitions to COOKED, via the mark_meal_cooked() RPC (0006).
 */
export const MealLogService = {
  /**
   * @param {string} householdId
   * @param {{ from?: string, to?: string }} [dateRange]
   * @returns {Promise<Array<Object>>}
   */
  async getMealLogs(householdId, dateRange = {}) {
    if (!householdId) return []
    try {
      let query = supabaseClient.from('meal_log').select('*').eq('household_id', householdId)
      if (dateRange.from) query = query.gte('date', dateRange.from)
      if (dateRange.to) query = query.lte('date', dateRange.to)

      const { data, error } = await query.order('date', { ascending: true })
      if (error) throw normalizeError(error, 'MEAL_LOG_FETCH_FAILED')
      return data ?? []
    } catch (err) {
      throw normalizeError(err, 'MEAL_LOG_FETCH_FAILED')
    }
  },

  /**
   * Creates a meal_log row in the default 'planned' state.
   * @param {string} householdId
   * @param {{ date: string, meal_type: string, recipe_id?: string, headcount?: number, notes?: string }} payload
   * @returns {Promise<Object>}
   */
  async createMealLog(householdId, payload) {
    if (!householdId) throw normalizeError('Missing household_id', 'MEAL_LOG_CREATE_FAILED')
    try {
      const { data, error } = await supabaseClient
        .from('meal_log')
        .insert({ ...payload, household_id: householdId, status: 'planned' })
        .select()
        .single()
      if (error) throw normalizeError(error, 'MEAL_LOG_CREATE_FAILED')
      return data
    } catch (err) {
      throw normalizeError(err, 'MEAL_LOG_CREATE_FAILED')
    }
  },

  /**
   * @param {string} householdId
   * @param {string} mealLogId
   * @returns {Promise<{success: boolean}>}
   */
  async markAsSkipped(householdId, mealLogId) {
    if (!householdId || !mealLogId) throw normalizeError('Missing household_id or meal_log_id', 'MEAL_LOG_UPDATE_FAILED')
    try {
      const { error } = await supabaseClient
        .from('meal_log')
        .update({ status: 'skipped' })
        .eq('id', mealLogId)
        .eq('household_id', householdId)
      if (error) throw normalizeError(error, 'MEAL_LOG_UPDATE_FAILED')
      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'MEAL_LOG_UPDATE_FAILED')
    }
  },

  /**
   * Convenience wrapper for the Recipe Detail "Cook Now" flow: creates a meal_log (status
   * 'planned') for a recipe cooked right now, then immediately marks it cooked. Two separate
   * calls, not one transaction — but the intermediate state (a 'planned' meal_log with no
   * deduction yet) is safe: if markAsCooked fails, the meal simply stays 'planned' rather than
   * silently losing the cook record or double-deducting.
   *
   * @param {string} householdId
   * @param {{ recipeId: string, mealType: string, servings: number, requiredIngredients: Array }} params
   * @returns {Promise<{success, mealLogId, alreadyCooked, cookedAt, hasShortfall, deductions}>}
   */
  async cookRecipeNow(householdId, { recipeId, mealType, servings, requiredIngredients = [] }) {
    if (!householdId || !recipeId) throw normalizeError('Missing household_id or recipe_id', 'MEAL_COOK_VALIDATION_ERROR')
    const mealLog = await this.createMealLog(householdId, {
      date: new Date().toISOString().slice(0, 10),
      meal_type: mealType || 'dinner',
      recipe_id: recipeId,
      headcount: servings || 1,
    })
    return this.markAsCooked(householdId, mealLog.id, requiredIngredients)
  },

  /**
   * Cooked meal history, most recent first, with the associated recipe embedded (avoids N+1).
   * @param {string} householdId
   * @param {{ limit?: number, offset?: number, recipeId?: string }} [pagination]
   * @returns {Promise<{ mealLogs: Array<Object>, hasMore: boolean }>}
   */
  async getMealHistory(householdId, pagination = {}) {
    const { limit = 20, offset = 0, recipeId } = pagination
    if (!householdId) return { mealLogs: [], hasMore: false }
    try {
      let query = supabaseClient
        .from('meal_log')
        .select('*, recipes(id, name, cuisine, meal_type, image_url)')
        .eq('household_id', householdId)
        .eq('status', 'cooked')
      if (recipeId) query = query.eq('recipe_id', recipeId)

      const { data, error } = await query
        .order('cooked_at', { ascending: false })
        .range(offset, offset + limit)

      if (error) throw normalizeError(error, 'MEAL_HISTORY_FETCH_FAILED')
      const rows = data ?? []
      const hasMore = rows.length > limit
      return { mealLogs: hasMore ? rows.slice(0, limit) : rows, hasMore }
    } catch (err) {
      throw normalizeError(err, 'MEAL_HISTORY_FETCH_FAILED')
    }
  },

  /**
   * Distinct recipe IDs cooked most recently, for the Library's "Recently cooked" filter.
   * @param {string} householdId
   * @param {number} [limit=10]
   * @returns {Promise<Array<string>>}
   */
  async getRecentlyCookedRecipeIds(householdId, limit = 10) {
    if (!householdId) return []
    try {
      const { data, error } = await supabaseClient
        .from('meal_log')
        .select('recipe_id')
        .eq('household_id', householdId)
        .eq('status', 'cooked')
        .not('recipe_id', 'is', null)
        .order('cooked_at', { ascending: false })
        .limit(limit * 3) // over-fetch to account for repeat recipes before de-duplicating

      if (error) throw normalizeError(error, 'MEAL_HISTORY_FETCH_FAILED')
      const seen = new Set()
      for (const row of data ?? []) {
        seen.add(row.recipe_id)
        if (seen.size >= limit) break
      }
      return Array.from(seen)
    } catch (err) {
      logger.warn('Failed to fetch recently cooked recipe ids:', err)
      return []
    }
  },

  /**
   * Ingredient-level deduction audit trail for a single cooked meal.
   * @param {string} mealLogId
   * @returns {Promise<Array<Object>>}
   */
  async getStockDeductionsForMeal(mealLogId) {
    if (!mealLogId) return []
    try {
      const { data, error } = await supabaseClient
        .from('stock_deductions')
        .select('*, inventory(canonical_name)')
        .eq('meal_log_id', mealLogId)
        .order('deducted_at', { ascending: true })
      if (error) throw normalizeError(error, 'STOCK_DEDUCTIONS_FETCH_FAILED')
      return data ?? []
    } catch (err) {
      logger.warn('Failed to fetch stock deductions for meal:', err)
      return []
    }
  },

  /**
   * Transitions a meal to COOKED and atomically FIFO-deducts each required ingredient via the
   * mark_meal_cooked() RPC. Idempotent: re-calling on an already-cooked meal returns
   * `already_cooked: true` without deducting stock again (enforced server-side, not just here).
   *
   * @param {string} householdId
   * @param {string} mealLogId
   * @param {Array<{canonical_name: string, quantity_grams: number}>} requiredIngredients - Typically
   *   RecipeService.scaleRecipeIngredients(...) output, plus roti flour if applicable.
   * @returns {Promise<{success, mealLogId, alreadyCooked, cookedAt, hasShortfall, deductions}>}
   */
  async markAsCooked(householdId, mealLogId, requiredIngredients = []) {
    if (!householdId || !mealLogId) {
      throw normalizeError('Missing household_id or meal_log_id', 'MEAL_COOK_VALIDATION_ERROR')
    }
    try {
      const { data, error } = await supabaseClient.rpc('mark_meal_cooked', {
        p_payload: {
          household_id: householdId,
          meal_log_id: mealLogId,
          required_ingredients: requiredIngredients,
        },
      })
      if (error) throw normalizeError(error, 'MEAL_COOK_FAILED')

      if (data.has_shortfall) {
        logger.warn('Meal marked cooked with ingredient shortfall (pantry ran low):', {
          householdId,
          mealLogId,
          deductions: data.deductions,
        })
      }

      return {
        success: data.success,
        mealLogId: data.meal_log_id,
        alreadyCooked: Boolean(data.already_cooked),
        cookedAt: data.cooked_at,
        hasShortfall: Boolean(data.has_shortfall),
        deductions: data.deductions ?? [],
      }
    } catch (err) {
      throw normalizeError(err, 'MEAL_COOK_FAILED')
    }
  },
}
