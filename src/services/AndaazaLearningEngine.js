import { supabaseClient } from './supabaseClient.js'
import { ConsumptionProfileService } from './ConsumptionProfileService.js'
import { PredictionService } from './PredictionService.js'
import { HouseholdIntelligenceService } from './HouseholdIntelligenceService.js'
import { normalizeError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { convertToUnitGrams } from '../utils/units.js'

/**
 * AndaazaLearningEngine
 * Core Intelligence Engine responsible for processing purchase events, updating consumption profiles,
 * calculating deterministic prediction caches, and maintaining household intelligence profiles.
 * Runs completely asynchronously post-commit.
 */
export const AndaazaLearningEngine = {
  /**
   * Main asynchronous learning entry point called post-commit.
   * 
   * @param {string} householdId 
   * @param {Array<Object>} activeItems 
   * @param {Object} [billMeta={}] 
   * @returns {Promise<Object>} Learning processing result summary
   */
  async processPostCommitLearning(householdId, activeItems = [], billMeta = {}) {
    const startTime = performance.now()
    if (!householdId || !Array.isArray(activeItems) || activeItems.length === 0) {
      return { success: false, reason: 'EMPTY_PAYLOAD' }
    }

    try {
      logger.info(`[AndaazaLearningEngine] Processing post-commit learning for household ${householdId}`, {
        householdId,
        itemCount: activeItems.length,
      })

      // 1. Process each item: insert purchase pattern & update ingredient consumption profile
      const updatedProfiles = []
      const predictions = []

      for (const item of activeItems) {
        const userEdits = item.userEdits || {}
        const ocr = item.ocr || {}
        const match = item.match || {}

        const canonicalName = (userEdits.canonicalName || match.canonicalName || ocr.itemName || '').trim()
        if (!canonicalName) continue

        const qtyValue = Number(userEdits.quantity || ocr.quantity) || 1
        const unit = (userEdits.unit || ocr.unit || 'g').toLowerCase().trim()
        const qtyGrams = convertToUnitGrams(qtyValue, unit)
        const price = userEdits.price !== undefined && userEdits.price !== '' ? Number(userEdits.price) : null
        const purchaseDate = billMeta.billDate || new Date().toISOString().slice(0, 10)
        const brand = userEdits.brand || ocr.brand || null

        // Fetch existing consumption profile
        const existingProfile = await ConsumptionProfileService.getIngredientProfile(householdId, canonicalName)

        // Compute updated metrics
        const updatedMetrics = ConsumptionProfileService.calculateProfileUpdate(
          existingProfile,
          { quantityGrams: qtyGrams, purchaseDate, brand, unit },
          []
        )

        // Calculate Depletion Prediction from the actual inventory balance (already updated by
        // commit_scanned_bill before this hook runs) — NOT a derived estimate from purchase-size
        // history, which would drift further from reality with every repeat purchase.
        let currentStockGrams = qtyGrams
        try {
          const { data: invRow } = await supabaseClient
            .from('inventory')
            .select('quantity_grams')
            .eq('household_id', householdId)
            .eq('canonical_name', canonicalName)
            .maybeSingle()
          if (invRow?.quantity_grams !== undefined && invRow?.quantity_grams !== null) {
            currentStockGrams = Number(invRow.quantity_grams)
          }
        } catch (err) {
          logger.warn('Failed to fetch current inventory stock for depletion prediction:', err)
        }
        const depletion = PredictionService.calculateDepletion(currentStockGrams, updatedMetrics.consumption_velocity_g_per_day, purchaseDate)

        updatedMetrics.predicted_depletion_date = depletion.predictedDepletionDate

        // Save pattern append-only (non-blocking DB write)
        try {
          await supabaseClient.from('purchase_patterns').insert({
            household_id: householdId,
            canonical_name: canonicalName,
            bill_id: billMeta.billId || null,
            purchase_date: purchaseDate,
            quantity_grams: qtyGrams,
            brand: brand,
            cost: price,
          })
        } catch (err) {
          logger.warn('Failed to insert purchase_pattern event:', err)
        }

        // Upsert ingredient_consumption_profile
        try {
          await supabaseClient.from('ingredient_consumption_profile').upsert(
            {
              household_id: householdId,
              canonical_name: canonicalName,
              category: userEdits.category || match.category || 'Miscellaneous',
              ...updatedMetrics,
            },
            { onConflict: 'household_id, canonical_name' }
          )
        } catch (err) {
          logger.warn('Failed to upsert ingredient_consumption_profile:', err)
        }

        // Upsert prediction_cache
        try {
          await supabaseClient.from('prediction_cache').upsert(
            {
              household_id: householdId,
              canonical_name: canonicalName,
              predicted_depletion_date: depletion.predictedDepletionDate,
              days_until_depletion: depletion.daysUntilDepletion,
              is_low_stock_risk: depletion.isLowStockRisk,
              confidence_score: updatedMetrics.confidence_score,
              calculated_at: new Date().toISOString(),
            },
            { onConflict: 'household_id, canonical_name' }
          )
        } catch (err) {
          logger.warn('Failed to upsert prediction_cache:', err)
        }

        updatedProfiles.push({ canonicalName, ...updatedMetrics })
        predictions.push({ canonicalName, ...depletion })
      }

      // 2. Recalculate and update Household Learning Profile
      let householdProfileSummary = null
      try {
        const { data: invData } = await supabaseClient.from('inventory').select('canonical_name, category').eq('household_id', householdId)
        const { data: billData } = await supabaseClient.from('bills').select('bill_date, created_at').eq('household_id', householdId)

        householdProfileSummary = HouseholdIntelligenceService.calculateHouseholdMetrics(householdId, invData || [], billData || [])

        await supabaseClient.from('household_learning_profile').upsert(householdProfileSummary, { onConflict: 'household_id' })
      } catch (err) {
        logger.warn('Failed to update household_learning_profile:', err)
      }

      const execTime = performance.now() - startTime
      logger.info(`[AndaazaLearningEngine] Successfully processed learning for ${updatedProfiles.length} ingredients in ${execTime.toFixed(2)}ms`, {
        householdId,
        profilesUpdated: updatedProfiles.length,
        executionTimeMs: execTime,
      })

      return {
        success: true,
        profilesUpdated: updatedProfiles.length,
        predictionsCount: predictions.length,
        executionTimeMs: execTime,
        householdProfileSummary,
      }
    } catch (err) {
      logger.warn('[AndaazaLearningEngine] Post-commit learning caught silent error:', err)
      return {
        success: false,
        error: normalizeError(err).message,
      }
    }
  },
}
