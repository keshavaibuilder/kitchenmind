import { supabaseClient } from './supabaseClient.js'
import { logger } from '../utils/logger.js'
import { WEEKDAYS } from '../utils/formatters.js'

/**
 * HouseholdIntelligenceService
 * Manages global household intelligence summary, pantry diversity metrics, and category trends.
 */
export const HouseholdIntelligenceService = {
  /**
   * Evaluates global household metrics from inventory and bill history.
   * 
   * @param {string} householdId 
   * @param {Array<Object>} inventoryItems 
   * @param {Array<Object>} billHistory 
   * @returns {Object} Calculated household intelligence summary
   */
  calculateHouseholdMetrics(householdId, inventoryItems = [], billHistory = []) {
    const pantryDiversityScore = new Set(inventoryItems.map((i) => i.canonical_name.toLowerCase())).size

    // Category frequency breakdown
    const categoryCounts = new Map()
    inventoryItems.forEach((item) => {
      const cat = item.category || 'Miscellaneous'
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    })

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ category: cat, count }))

    // Preferred shopping day & frequency
    let shoppingFrequencyDays = 7.0
    let preferredShoppingDay = 'Sunday'

    if (billHistory.length > 1) {
      const dayOfWeekCounts = new Map()
      const billDates = []
      billHistory.forEach((b) => {
        const dateObj = new Date(b.bill_date || b.created_at)
        if (!isNaN(dateObj)) {
          billDates.push(dateObj)
          const dayName = WEEKDAYS[dateObj.getDay()]
          dayOfWeekCounts.set(dayName, (dayOfWeekCounts.get(dayName) || 0) + 1)
        }
      })

      let maxDayCount = 0
      dayOfWeekCounts.forEach((count, dayName) => {
        if (count > maxDayCount) {
          maxDayCount = count
          preferredShoppingDay = dayName
        }
      })

      // Average gap between consecutive bill dates (deduplicated, since multiple bills can
      // legitimately share a calendar date and shouldn't collapse the average toward zero).
      const uniqueSortedDates = [...new Set(billDates.map((d) => d.toISOString().slice(0, 10)))]
        .map((d) => new Date(d))
        .sort((a, b) => a - b)

      if (uniqueSortedDates.length > 1) {
        let totalGapDays = 0
        for (let i = 1; i < uniqueSortedDates.length; i++) {
          totalGapDays += (uniqueSortedDates[i] - uniqueSortedDates[i - 1]) / (1000 * 60 * 60 * 24)
        }
        shoppingFrequencyDays = Number((totalGapDays / (uniqueSortedDates.length - 1)).toFixed(2))
      }
    }

    return {
      household_id: householdId,
      pantry_diversity_score: pantryDiversityScore,
      shopping_frequency_days: shoppingFrequencyDays,
      top_categories: sortedCategories.slice(0, 5),
      preferred_shopping_day: preferredShoppingDay,
      total_bills_analyzed: billHistory.length,
      last_analyzed_at: new Date().toISOString(),
    }
  },

  /**
   * Read-only API to get current household intelligence profile.
   * 
   * @param {string} householdId 
   * @returns {Promise<Object|null>}
   */
  async getHouseholdProfile(householdId) {
    if (!householdId) return null
    try {
      const { data, error } = await supabaseClient
        .from('household_learning_profile')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (err) {
      logger.warn('Failed to fetch household_learning_profile:', err)
      return null
    }
  },
}
