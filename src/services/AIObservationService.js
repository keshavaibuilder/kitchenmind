import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/**
 * AI Observation Types
 */
export const OBSERVATION_TYPES = {
  NEW_INGREDIENT_DISCOVERED: 'NEW_INGREDIENT_DISCOVERED',
  UNUSUAL_PURCHASE_QUANTITY: 'UNUSUAL_PURCHASE_QUANTITY',
  DUPLICATE_PURCHASE: 'DUPLICATE_PURCHASE',
  LOW_STOCK_AFTER_PURCHASE: 'LOW_STOCK_AFTER_PURCHASE',
  FIRST_PURCHASE: 'FIRST_PURCHASE',
  CATEGORY_GROWTH: 'CATEGORY_GROWTH',
  PANTRY_DIVERSITY: 'PANTRY_DIVERSITY',
}

/**
 * AIObservationService
 * Foundation service for generating and storing AI learning observations post-commit.
 * Runs asynchronously and isolated from core ACID transactions.
 */
export const AIObservationService = {
  /**
   * Evaluates committed items against existing household inventory to generate observations.
   * 
   * @param {string} householdId 
   * @param {Array<Object>} activeItems 
   * @param {Array<Object>} existingInventory 
   * @returns {Promise<Array<Object>>} Array of generated observation objects
   */
  async generateObservations(householdId, activeItems = [], existingInventory = []) {
    if (!householdId || !Array.isArray(activeItems)) return []

    const observations = []
    const existingMap = new Map(existingInventory.map((item) => [item.canonical_name.toLowerCase(), item]))
    const itemCounts = new Map()

    for (const item of activeItems) {
      const canonical = (item.userEdits?.canonicalName || item.match?.canonicalName || item.ocr?.itemName || '').trim()
      if (!canonical) continue

      const lowerCanonical = canonical.toLowerCase()
      const existingItem = existingMap.get(lowerCanonical)
      const qtyGrams = Number(item.userEdits?.quantity || item.ocr?.quantity || 1) * (item.userEdits?.unit === 'kg' || item.userEdits?.unit === 'L' ? 1000 : 1)

      // 1. First Purchase & New Ingredient Discovered
      if (!existingItem) {
        observations.push({
          household_id: householdId,
          observation_type: OBSERVATION_TYPES.NEW_INGREDIENT_DISCOVERED,
          canonical_name: canonical,
          details: { message: `New ingredient "${canonical}" added to household kitchen`, quantity_grams: qtyGrams },
          created_at: new Date().toISOString(),
        })

        observations.push({
          household_id: householdId,
          observation_type: OBSERVATION_TYPES.FIRST_PURCHASE,
          canonical_name: canonical,
          details: { message: `First recorded purchase of "${canonical}"`, quantity_grams: qtyGrams },
          created_at: new Date().toISOString(),
        })
      }

      // 2. Unusual Purchase Quantity (> 3000g or 3x threshold)
      if (qtyGrams >= 3000) {
        observations.push({
          household_id: householdId,
          observation_type: OBSERVATION_TYPES.UNUSUAL_PURCHASE_QUANTITY,
          canonical_name: canonical,
          details: { message: `Large quantity purchase detected for "${canonical}" (${qtyGrams}g)`, quantity_grams: qtyGrams },
          created_at: new Date().toISOString(),
        })
      }

      // 3. Duplicate Purchase in Same Bill
      const currentCount = (itemCounts.get(lowerCanonical) || 0) + 1
      itemCounts.set(lowerCanonical, currentCount)
      if (currentCount > 1) {
        observations.push({
          household_id: householdId,
          observation_type: OBSERVATION_TYPES.DUPLICATE_PURCHASE,
          canonical_name: canonical,
          details: { message: `Multiple entries for "${canonical}" in single receipt`, occurrence: currentCount },
          created_at: new Date().toISOString(),
        })
      }
    }

    // 4. Pantry Diversity Milestone Check
    const totalUniqueCount = existingInventory.length + observations.filter((o) => o.observation_type === OBSERVATION_TYPES.NEW_INGREDIENT_DISCOVERED).length
    if ([5, 10, 25, 50, 100].includes(totalUniqueCount)) {
      observations.push({
        household_id: householdId,
        observation_type: OBSERVATION_TYPES.PANTRY_DIVERSITY,
        canonical_name: 'Pantry Milestone',
        details: { message: `Pantry diversity milestone reached: ${totalUniqueCount} unique ingredients!`, total_unique: totalUniqueCount },
        created_at: new Date().toISOString(),
      })
    }

    return observations
  },

  /**
   * Persists recorded AI observations to andaaza_profile or logs telemetry asynchronously.
   * Failure here NEVER affects the committed bill transaction.
   * 
   * @param {string} householdId 
   * @param {Array<Object>} activeItems 
   * @returns {Promise<{ success: boolean, observationsCount: number }>}
   */
  async recordPostCommitObservations(householdId, activeItems = []) {
    try {
      // Fetch existing inventory for delta comparison
      let existingInventory = []
      try {
        const { data } = await supabaseClient
          .from('inventory')
          .select('id, canonical_name, category, quantity_grams, low_stock_threshold')
          .eq('household_id', householdId)
        existingInventory = data || []
      } catch (err) {
        logger.warn('Failed to fetch existing inventory for AI observation delta evaluation:', err)
      }

      const observations = await this.generateObservations(householdId, activeItems, existingInventory)

      // Persist to ai_observations (append-only) so the Kitchen Intelligence Dashboard's
      // Observation Timeline has real history — previously these were generated and logged
      // but never written anywhere.
      if (observations.length > 0) {
        try {
          const { error } = await supabaseClient.from('ai_observations').insert(observations)
          if (error) throw error
        } catch (err) {
          logger.warn('Failed to persist AI observations to ai_observations:', err)
        }
      }

      logger.info(`Generated ${observations.length} AI post-commit observations for household ${householdId}`, {
        householdId,
        count: observations.length,
      })

      return {
        success: true,
        observationsCount: observations.length,
        observations,
      }
    } catch (err) {
      // Non-blocking catch
      logger.warn('AI Observation processing failed silently in post-commit hook:', err)
      return {
        success: false,
        observationsCount: 0,
        error: normalizeError(err).message,
      }
    }
  },

  /**
   * Read-only API for the Observation Timeline — a single aggregated query, most recent first.
   * @param {string} householdId
   * @param {number} [limit=20]
   * @returns {Promise<Array<Object>>}
   */
  async getRecentObservations(householdId, limit = 20) {
    if (!householdId) return []
    try {
      const { data, error } = await supabaseClient
        .from('ai_observations')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data ?? []
    } catch (err) {
      logger.warn('Failed to fetch recent AI observations:', err)
      return []
    }
  },
}
