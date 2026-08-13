/**
 * KitchenMind Proactive Insight Registry (Sprint 7A)
 * Defines controlled insight types, categories, default severities, and confidence floors.
 */

export const INSIGHT_CATEGORIES = {
  INVENTORY: 'INVENTORY',
  MEALS: 'MEALS',
  SHOPPING: 'SHOPPING',
  HOUSEHOLD: 'HOUSEHOLD',
}

export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
}

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
}

export const MIN_CONFIDENCE_THRESHOLD = 0.60

export const INSIGHT_TYPES = {
  // Inventory
  LOW_STOCK: {
    type: 'LOW_STOCK',
    category: INSIGHT_CATEGORIES.INVENTORY,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    minConfidence: 0.70,
    titleTemplate: (name) => `${name} is low on stock`,
  },
  LIKELY_DEPLETION: {
    type: 'LIKELY_DEPLETION',
    category: INSIGHT_CATEGORIES.INVENTORY,
    defaultSeverity: SEVERITY_LEVELS.CRITICAL,
    minConfidence: 0.65,
    titleTemplate: (name, days) => `${name} likely to run out in ${days} ${days === 1 ? 'day' : 'days'}`,
  },
  USE_SOON: {
    type: 'USE_SOON',
    category: INSIGHT_CATEGORIES.INVENTORY,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    minConfidence: 0.80,
    titleTemplate: (name) => `${name} expires soon — use in upcoming meals`,
  },
  STOCK_INCONSISTENCY: {
    type: 'STOCK_INCONSISTENCY',
    category: INSIGHT_CATEGORIES.INVENTORY,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.60,
    titleTemplate: (name) => `Check stock level for ${name}`,
  },

  // Meals
  DINNER_NOT_PLANNED: {
    type: 'DINNER_NOT_PLANNED',
    category: INSIGHT_CATEGORIES.MEALS,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    minConfidence: 0.90,
    titleTemplate: () => `Tonight's dinner is not planned yet`,
  },
  INGREDIENTS_AVAILABLE_FOR_MEAL: {
    type: 'INGREDIENTS_AVAILABLE_FOR_MEAL',
    category: INSIGHT_CATEGORIES.MEALS,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.85,
    titleTemplate: (recipeName) => `All ingredients in stock for ${recipeName}`,
  },
  REPEATED_MEAL_PATTERN: {
    type: 'REPEATED_MEAL_PATTERN',
    category: INSIGHT_CATEGORIES.MEALS,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.75,
    titleTemplate: (mealName) => `${mealName} cooked 3+ times this week`,
  },

  // Shopping
  EXPECTED_PURCHASE: {
    type: 'EXPECTED_PURCHASE',
    category: INSIGHT_CATEGORIES.SHOPPING,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.65,
    titleTemplate: (name) => `Routine re-stock due for ${name}`,
  },
  SHOPPING_GAP: {
    type: 'SHOPPING_GAP',
    category: INSIGHT_CATEGORIES.SHOPPING,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    minConfidence: 0.75,
    titleTemplate: (count) => `${count} low stock items pending shopping`,
  },

  // Household
  PANTRY_DIVERSITY_CHANGE: {
    type: 'PANTRY_DIVERSITY_CHANGE',
    category: INSIGHT_CATEGORIES.HOUSEHOLD,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.70,
    titleTemplate: (ingredient) => `New pantry ingredient added: ${ingredient}`,
  },
  CONSUMPTION_PATTERN_CHANGE: {
    type: 'CONSUMPTION_PATTERN_CHANGE',
    category: INSIGHT_CATEGORIES.HOUSEHOLD,
    defaultSeverity: SEVERITY_LEVELS.INFO,
    minConfidence: 0.65,
    titleTemplate: (name) => `Higher consumption detected for ${name}`,
  },
}
