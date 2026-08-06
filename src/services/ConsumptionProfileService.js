import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * ConsumptionProfileService
 * Calculates and manages ingredient-level consumption velocity, purchase intervals, brand evolution, and confidence scores.
 */
export const ConsumptionProfileService = {
  /**
   * Computes updated statistical consumption profile metrics for a single ingredient.
   * 
   * @param {Object} currentProfile - Existing profile or null
   * @param {Object} newPurchaseEvent - { quantityGrams, purchaseDate, brand, unit }
   * @param {Array<Object>} history - Historical purchase pattern events
   * @returns {Object} Calculated consumption profile metrics
   */
  calculateProfileUpdate(currentProfile, newPurchaseEvent, history = []) {
    const { quantityGrams, purchaseDate = new Date().toISOString().slice(0, 10), brand, unit = 'g' } = newPurchaseEvent
    const qty = Number(quantityGrams) || 1000

    let sampleCount = (currentProfile?.sample_count || 0) + 1
    let avgPurchaseGrams = currentProfile?.avg_purchase_grams
      ? Math.round(currentProfile.avg_purchase_grams * 0.6 + qty * 0.4)
      : qty

    // Calculate Purchase Interval (Days). Validate the RAW gap (not a clamped one) so a
    // backdated purchase_date earlier than the last recorded purchase is rejected rather than
    // silently floored up to 1 day and skewing the average like a same-day duplicate would.
    let avgIntervalDays = currentProfile?.avg_interval_days || 14.0
    if (currentProfile?.last_purchased_at) {
      const lastDate = new Date(currentProfile.last_purchased_at)
      const currentDate = new Date(purchaseDate)
      const rawIntervalDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24))
      if (rawIntervalDays > 0 && rawIntervalDays < 180) {
        avgIntervalDays = Number((avgIntervalDays * 0.5 + rawIntervalDays * 0.5).toFixed(2))
      }
    }

    // Consumption Velocity (g/day)
    const velocityGramsPerDay = Number((avgPurchaseGrams / (avgIntervalDays || 14)).toFixed(2))

    // Deterministic Confidence Score formula: min(0.95, 0.40 + (sample_count * 0.10))
    const confidenceScore = Number(Math.min(0.95, 0.40 + sampleCount * 0.10).toFixed(3))

    // Brand preference evolution (most frequent or latest non-empty brand)
    let preferredBrand = currentProfile?.preferred_brand || brand || null
    if (brand && history.length > 0) {
      const brandCounts = new Map()
      history.forEach((h) => {
        if (h.brand) brandCounts.set(h.brand, (brandCounts.get(h.brand) || 0) + 1)
      })
      if (brand) brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1)

      let maxCount = 0
      brandCounts.forEach((count, b) => {
        if (count > maxCount) {
          maxCount = count
          preferredBrand = b
        }
      })
    }

    return {
      avg_interval_days: avgIntervalDays,
      avg_purchase_grams: avgPurchaseGrams,
      consumption_velocity_g_per_day: velocityGramsPerDay,
      preferred_brand: preferredBrand,
      preferred_unit: unit,
      confidence_score: confidenceScore,
      sample_count: sampleCount,
      last_purchased_at: new Date(purchaseDate).toISOString(),
      updated_at: new Date().toISOString(),
    }
  },

  /**
   * Fetches the consumption profile for a canonical ingredient in a household.
   * 
   * @param {string} householdId 
   * @param {string} canonicalName 
   * @returns {Promise<Object|null>}
   */
  async getIngredientProfile(householdId, canonicalName) {
    if (!householdId || !canonicalName) return null
    try {
      const { data, error } = await supabaseClient
        .from('ingredient_consumption_profile')
        .select('*')
        .eq('household_id', householdId)
        .eq('canonical_name', canonicalName)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (err) {
      logger.warn('Failed to fetch ingredient consumption profile:', err)
      return null
    }
  },
}
