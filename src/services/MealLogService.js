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
