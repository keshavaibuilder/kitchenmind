import { supabaseClient } from './supabaseClient.js'
import { logger } from '../utils/logger.js'

/**
 * PredictionService
 * Calculates deterministic stock depletion dates, replenishment windows, and pantry health scores.
 */
export const PredictionService = {
  /**
   * Calculates predicted depletion date and low stock risk for an ingredient.
   * 
   * @param {number} currentStockGrams 
   * @param {number} velocityGramsPerDay 
   * @param {string|Date} [fromDate=now] 
   * @returns {Object} { predictedDepletionDate, daysUntilDepletion, isLowStockRisk }
   */
  calculateDepletion(currentStockGrams, velocityGramsPerDay, fromDate = new Date()) {
    const stock = Math.max(0, Number(currentStockGrams) || 0)
    const velocity = Math.max(1, Number(velocityGramsPerDay) || 50)

    const daysRemaining = Math.floor(stock / velocity)
    const baseDate = new Date(fromDate)
    const depletionDate = new Date(baseDate)
    depletionDate.setDate(baseDate.getDate() + daysRemaining)

    const isLowStockRisk = daysRemaining <= 3

    return {
      predictedDepletionDate: depletionDate.toISOString().slice(0, 10),
      daysUntilDepletion: daysRemaining,
      isLowStockRisk,
    }
  },

  /**
   * Calculates Pantry Health Score (0 - 100) based on stock security across ingredients.
   * Score = (% of pantry items with > 7 days remaining stock) * 100
   * 
   * @param {Array<Object>} ingredientDepletions - Array of { daysUntilDepletion }
   * @returns {number} Health score (0 to 100)
   */
  calculatePantryHealthScore(ingredientDepletions = []) {
    if (!ingredientDepletions || ingredientDepletions.length === 0) return 100

    const healthyCount = ingredientDepletions.filter((item) => (item.daysUntilDepletion ?? 14) >= 7).length
    return Math.round((healthyCount / ingredientDepletions.length) * 100)
  },

  /**
   * Fetches prediction summary for a household.
   *
   * @param {string} householdId
   * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Injectable client; see
   *   InventoryService.getInventory for why.
   * @returns {Promise<Array<Object>>}
   */
  async getHouseholdPredictions(householdId, client = supabaseClient) {
    if (!householdId) return []
    try {
      const { data, error } = await client
        .from('prediction_cache')
        .select('*')
        .eq('household_id', householdId)
        .order('days_until_depletion', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err) {
      logger.warn('Failed to fetch household predictions from prediction_cache:', err)
      return []
    }
  },
}
