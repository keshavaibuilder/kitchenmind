import { INSIGHT_TYPES, MIN_CONFIDENCE_THRESHOLD, CONFIDENCE_LEVELS } from './insightRegistry.js'
import { RecipeService } from '../RecipeService.js'
import { computeIngredientAvailability, summarizeAvailability } from '../../utils/ingredientAvailability.js'

function getConfidenceLevel(score) {
  if (score >= 0.80) return CONFIDENCE_LEVELS.HIGH
  if (score >= 0.60) return CONFIDENCE_LEVELS.MEDIUM
  return CONFIDENCE_LEVELS.LOW
}

export const InsightEngine = {
  /**
   * Deterministically evaluates household intelligence data and generates structured proactive insights.
   *
   * @param {Object} context
   * @param {string} context.householdId
   * @param {Array<Object>} [context.pantryItems]
   * @param {Array<Object>} [context.predictions]
   * @param {Array<Object>} [context.expiringBatches]
   * @param {Array<Object>} [context.mealLogs]
   * @param {Array<Object>} [context.recipes]
   * @param {Array<Object>} [context.observations]
   * @param {Object} [context.preferences]
   * @param {Array<Object>} [context.memories]
   * @returns {Array<Object>} Array of deterministic InsightObjects
   */
  generateInsights(context = {}) {
    const {
      householdId,
      pantryItems = [],
      predictions = [],
      expiringBatches = [],
      mealLogs = [],
      recipes = [],
      observations = [],
    } = context

    if (!householdId) return []

    const insights = []
    const todayStr = new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()

    // 1. DINNER_NOT_PLANNED
    const todaysDinner = mealLogs.find(
      (m) => (m.date === todayStr || m.created_at?.slice(0, 10) === todayStr) && m.meal_type === 'dinner' && m.status !== 'cancelled'
    )
    if (!todaysDinner) {
      const confidenceScore = 0.95
      insights.push({
        insight_id: `ins-dinner-unplanned-${todayStr}`,
        insight_type: INSIGHT_TYPES.DINNER_NOT_PLANNED.type,
        household_id: householdId,
        title: INSIGHT_TYPES.DINNER_NOT_PLANNED.titleTemplate(),
        summary: `You have no meal scheduled for dinner today (${todayStr}). Plan ahead to ensure all required ingredients are ready.`,
        severity: INSIGHT_TYPES.DINNER_NOT_PLANNED.defaultSeverity,
        evidence: [
          {
            type: 'MEAL_PLAN_SCHEDULE',
            source: 'meal_log',
            value: 0,
            details: `No active meal log entry found for meal_type 'dinner' on date ${todayStr}`,
          },
        ],
        confidence: {
          score: confidenceScore,
          level: getConfidenceLevel(confidenceScore),
        },
        created_at: nowIso,
        expires_at: `${todayStr}T23:59:59Z`,
        deduplication_key: `DINNER_UNPLANNED:${todayStr}`,
        related_entities: { date: todayStr },
        suggested_next_step: {
          text: 'Ask Copilot for dinner ideas based on current pantry stock',
          askCopilotPrompt: "What should I cook for dinner tonight with what I have in my pantry?",
        },
      })
    }

    // 2. LIKELY_DEPLETION (Depletion risk within 1-3 days)
    const depletingPredictions = predictions.filter(
      (p) => p.is_low_stock_risk && p.days_until_depletion >= 0 && p.days_until_depletion <= 3
    )

    for (const pred of depletingPredictions) {
      const canonical = pred.canonical_name || 'Item'
      const days = pred.days_until_depletion
      const confidenceScore = Math.min(1.0, Number(pred.confidence_score) || 0.85)
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString()

      insights.push({
        insight_id: `ins-depletion-${canonical.toLowerCase()}-${todayStr}`,
        insight_type: INSIGHT_TYPES.LIKELY_DEPLETION.type,
        household_id: householdId,
        title: INSIGHT_TYPES.LIKELY_DEPLETION.titleTemplate(canonical, days),
        summary: `Based on your household consumption velocity, ${canonical} is predicted to deplete in approximately ${days} ${days === 1 ? 'day' : 'days'} (${pred.predicted_depletion_date || 'soon'}).`,
        severity: INSIGHT_TYPES.LIKELY_DEPLETION.defaultSeverity,
        evidence: [
          {
            type: 'PREDICTED_DEPLETION_DAYS',
            source: 'prediction_cache',
            value: days,
            details: `Days until depletion calculated as ${days} days`,
          },
          {
            type: 'PREDICTED_DEPLETION_DATE',
            source: 'prediction_cache',
            value: pred.predicted_depletion_date || 'Upcoming',
            details: `Estimated depletion date is ${pred.predicted_depletion_date}`,
          },
          {
            type: 'CONFIDENCE_SCORE',
            source: 'prediction_cache',
            value: confidenceScore,
            details: `Model confidence score ${Math.round(confidenceScore * 100)}%`,
          },
        ],
        confidence: {
          score: confidenceScore,
          level: getConfidenceLevel(confidenceScore),
        },
        created_at: nowIso,
        expires_at: expiresAt,
        deduplication_key: `LIKELY_DEPLETION:${canonical.toLowerCase()}`,
        related_entities: { canonicalName: canonical },
        suggested_next_step: {
          text: `Ask Copilot to re-stock ${canonical}`,
          askCopilotPrompt: `We are running low on ${canonical}. Can you suggest a re-stock quantity and shopping advice?`,
        },
      })
    }

    // 3. USE_SOON (Expiring pantry batches)
    const todayDate = new Date(todayStr)
    for (const batch of expiringBatches) {
      if (!batch.expiry_date) continue
      const canonical = batch.inventory?.canonical_name || 'Pantry item'
      const batchExpiryDate = new Date(batch.expiry_date)
      const daysUntilExpiry = Math.ceil((batchExpiryDate - todayDate) / 86_400_000)

      if (daysUntilExpiry <= 5) {
        const isExpired = daysUntilExpiry < 0
        const confidenceScore = 0.90
        const severity = isExpired ? 'critical' : 'warning'
        const title = isExpired
          ? `${canonical} batch expired (${batch.expiry_date})`
          : INSIGHT_TYPES.USE_SOON.titleTemplate(canonical)

        const matchingRecipe = recipes.find((r) =>
          r.recipe_ingredients?.some((ri) => ri.canonical_name?.toLowerCase() === canonical.toLowerCase())
        )

        insights.push({
          insight_id: `ins-use-soon-${batch.id}`,
          insight_type: INSIGHT_TYPES.USE_SOON.type,
          household_id: householdId,
          title,
          summary: isExpired
            ? `A batch of ${canonical} (${batch.remaining_grams || 0}g) passed its expiration date on ${batch.expiry_date}. Inspect and update stock.`
            : `A batch of ${canonical} (${batch.remaining_grams || 0}g) will expire in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}. Consider cooking a meal using ${canonical}.`,
          severity,
          evidence: [
            {
              type: 'EXPIRY_DATE',
              source: 'pantry_batch',
              value: batch.expiry_date,
              details: `Batch expiration date is ${batch.expiry_date}`,
            },
            {
              type: 'REMAINING_STOCK',
              source: 'pantry_batch',
              value: `${batch.remaining_grams || 0}g`,
              details: `Remaining batch quantity is ${batch.remaining_grams || 0}g`,
            },
          ],
          confidence: {
            score: confidenceScore,
            level: getConfidenceLevel(confidenceScore),
          },
          created_at: nowIso,
          expires_at: `${batch.expiry_date}T23:59:59Z`,
          deduplication_key: `USE_SOON:${batch.id}`,
          related_entities: { batchId: batch.id, canonicalName: canonical, recipeId: matchingRecipe?.id },
          suggested_next_step: {
            text: matchingRecipe ? `Cook ${matchingRecipe.name}` : `Ask Copilot recipes for ${canonical}`,
            askCopilotPrompt: `What recipes can I cook to use up ${canonical} before it expires?`,
          },
        })
      }
    }

    // 4. INGREDIENTS_AVAILABLE_FOR_MEAL (Ready to cook recipes)
    if (recipes.length > 0 && pantryItems.length > 0) {
      for (const recipe of recipes.slice(0, 5)) {
        let required = RecipeService.scaleRecipeIngredients(recipe, recipe.base_servings || 2)
        if (required.length === 0 && Array.isArray(recipe.recipe_ingredients)) {
          required = recipe.recipe_ingredients.map((ri) => ({
            canonical_name: ri.canonical_name,
            quantity_grams: Number(ri.quantity_grams || ri.base_quantity_grams || ri.quantity) || 0,
            is_optional: Boolean(ri.is_optional),
          }))
        }
        if (required.length === 0) continue
        const availability = computeIngredientAvailability(required, pantryItems)
        const summary = summarizeAvailability(availability)
        if (summary.missing === 0 && summary.low === 0) {
          const confidenceScore = 0.88
          insights.push({
            insight_id: `ins-ready-recipe-${recipe.id}`,
            insight_type: INSIGHT_TYPES.INGREDIENTS_AVAILABLE_FOR_MEAL.type,
            household_id: householdId,
            title: INSIGHT_TYPES.INGREDIENTS_AVAILABLE_FOR_MEAL.titleTemplate(recipe.name),
            summary: `You have 100% of required ingredients in stock for ${recipe.name} (${summary.available}/${summary.total} ingredients available).`,
            severity: INSIGHT_TYPES.INGREDIENTS_AVAILABLE_FOR_MEAL.defaultSeverity,
            evidence: [
              {
                type: 'INGREDIENT_MATCH_PERCENTAGE',
                source: 'pantry_item_and_recipe',
                value: '100%',
                details: `All ${summary.total} ingredients for ${recipe.name} matched in pantry stock`,
              },
            ],
            confidence: {
              score: confidenceScore,
              level: getConfidenceLevel(confidenceScore),
            },
            created_at: nowIso,
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            deduplication_key: `READY_RECIPE:${recipe.id}`,
            related_entities: { recipeId: recipe.id },
            suggested_next_step: {
              text: `Schedule ${recipe.name} for dinner`,
              actionProposal: {
                capabilityId: 'planner.add_meal',
                payload: { recipeId: recipe.id, mealType: 'dinner', date: todayStr, headcount: 2 },
                preview: {
                  action: `Schedule ${recipe.name} for dinner on ${todayStr}`,
                  affectedItems: [recipe.name],
                  quantities: ['1 meal'],
                  householdImpact: `Adds ${recipe.name} to today's meal planner`,
                  expectedResult: `Meal planned for ${todayStr}`,
                  irreversible: false,
                },
              },
              askCopilotPrompt: `How do I prepare ${recipe.name}?`,
            },
          })
          break // Limit to top 1 ready recipe recommendation
        }
      }
    }

    // 5. SHOPPING_GAP (Multiple low-stock items accumulate)
    const lowStockCount = predictions.filter((p) => p.is_low_stock_risk).length
    if (lowStockCount >= 3) {
      const confidenceScore = 0.80
      insights.push({
        insight_id: `ins-shopping-gap-${todayStr}`,
        insight_type: INSIGHT_TYPES.SHOPPING_GAP.type,
        household_id: householdId,
        title: INSIGHT_TYPES.SHOPPING_GAP.titleTemplate(lowStockCount),
        summary: `Your household has ${lowStockCount} items at low stock risk. Plan a shopping trip to re-stock kitchen staples.`,
        severity: INSIGHT_TYPES.SHOPPING_GAP.defaultSeverity,
        evidence: [
          {
            type: 'LOW_STOCK_COUNT',
            source: 'prediction_cache',
            value: lowStockCount,
            details: `${lowStockCount} items currently identified at low stock risk`,
          },
        ],
        confidence: {
          score: confidenceScore,
          level: getConfidenceLevel(confidenceScore),
        },
        created_at: nowIso,
        expires_at: new Date(Date.now() + 86_400_000 * 2).toISOString(),
        deduplication_key: `SHOPPING_GAP:${todayStr}`,
        related_entities: { lowStockCount },
        suggested_next_step: {
          text: 'Ask Copilot for a consolidated shopping list',
          askCopilotPrompt: 'What should I buy this weekend based on low stock items?',
        },
      })
    }

    // 6. LOW_STOCK (Items with quantity below threshold)
    const lowStockItems = pantryItems.filter((item) => {
      const qty = Number(item.quantity_grams) || Number(item.current_quantity) || 0
      const threshold = Number(item.low_stock_threshold) || 200
      return qty > 0 && qty <= threshold
    })

    for (const item of lowStockItems.slice(0, 2)) {
      const canonical = item.canonical_name || 'Ingredient'
      const qty = Number(item.quantity_grams) || Number(item.current_quantity) || 0
      const confidenceScore = 0.85

      // Only add if not already covered by LIKELY_DEPLETION
      const existingDepletion = insights.some((ins) => ins.deduplication_key === `LIKELY_DEPLETION:${canonical.toLowerCase()}`)
      if (!existingDepletion) {
        insights.push({
          insight_id: `ins-low-stock-${canonical.toLowerCase()}`,
          insight_type: INSIGHT_TYPES.LOW_STOCK.type,
          household_id: householdId,
          title: INSIGHT_TYPES.LOW_STOCK.titleTemplate(canonical),
          summary: `Current stock of ${canonical} (${qty}g) is below your minimum threshold.`,
          severity: INSIGHT_TYPES.LOW_STOCK.defaultSeverity,
          evidence: [
            {
              type: 'CURRENT_STOCK_QUANTITY',
              source: 'pantry_item',
              value: `${qty}g`,
              details: `Current stock level is ${qty}g`,
            },
          ],
          confidence: {
            score: confidenceScore,
            level: getConfidenceLevel(confidenceScore),
          },
          created_at: nowIso,
          expires_at: new Date(Date.now() + 86_400_000 * 2).toISOString(),
          deduplication_key: `LOW_STOCK:${canonical.toLowerCase()}`,
          related_entities: { canonicalName: canonical },
          suggested_next_step: {
            text: `Ask Copilot to re-stock ${canonical}`,
            askCopilotPrompt: `Can you add ${canonical} to my shopping list?`,
          },
        })
      }
    }

    // 7. PANTRY_DIVERSITY_CHANGE (Observation for new ingredient)
    const newIngObs = observations.find((o) => o.observation_type === 'NEW_INGREDIENT_DISCOVERED')
    if (newIngObs) {
      const canonical = newIngObs.canonical_name || 'Ingredient'
      const confidenceScore = 0.75
      insights.push({
        insight_id: `ins-pantry-diversity-${newIngObs.id || todayStr}`,
        insight_type: INSIGHT_TYPES.PANTRY_DIVERSITY_CHANGE.type,
        household_id: householdId,
        title: INSIGHT_TYPES.PANTRY_DIVERSITY_CHANGE.titleTemplate(canonical),
        summary: `You recently added ${canonical} to your kitchen inventory. Discover new recipes incorporating ${canonical}.`,
        severity: INSIGHT_TYPES.PANTRY_DIVERSITY_CHANGE.defaultSeverity,
        evidence: [
          {
            type: 'AI_OBSERVATION',
            source: 'ai_observation',
            value: canonical,
            details: `Observation recorded: New ingredient ${canonical} discovered`,
          },
        ],
        confidence: {
          score: confidenceScore,
          level: getConfidenceLevel(confidenceScore),
        },
        created_at: nowIso,
        expires_at: new Date(Date.now() + 86_400_000 * 3).toISOString(),
        deduplication_key: `PANTRY_DIVERSITY:${canonical.toLowerCase()}`,
        related_entities: { canonicalName: canonical },
        suggested_next_step: {
          text: `Find recipes using ${canonical}`,
          askCopilotPrompt: `What delicious recipes can I cook using ${canonical}?`,
        },
      })
    }

    // Filter out low confidence insights below threshold
    return insights.filter((ins) => ins.confidence.score >= MIN_CONFIDENCE_THRESHOLD)
  },
}
