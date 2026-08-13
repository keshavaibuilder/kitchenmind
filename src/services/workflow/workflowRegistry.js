/**
 * KitchenMind Controlled Workflow Registry (Sprint 7D)
 * Defines deterministic, evidence-backed proactive household workflows.
 * Dynamic LLM invention of arbitrary workflows is strictly prohibited.
 */

export const WORKFLOW_STATUS = {
  ELIGIBLE: 'ELIGIBLE',
  PROPOSED: 'PROPOSED',
  PRESENTED: 'PRESENTED',
  ACCEPTED: 'ACCEPTED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  DISMISSED: 'DISMISSED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
}

export const WORKFLOW_DEFINITIONS = {
  WORKFLOW_01: {
    workflow_id: 'WF-01-DEPLETION-SHOPPING',
    name: 'Shopping Assistance for Depleting Stock',
    description: 'Guides household to review and schedule re-stocking of items predicted to deplete soon.',
    trigger_insight_types: ['LIKELY_DEPLETION', 'LOW_STOCK'],
    minimum_confidence: 0.65,
    priority: 1,
    allowed_actions: ['inventory.add_item'],
    notification_policy: 'SCHEDULED',
    cooldown_hours: 24,
    expiration_hours: 48,
    requires_confirmation: true,
    version: '1.0.0',
    enabled: true,
    titleTemplate: (canonicalName) => `Re-stock assistance for ${canonicalName}`,
    summaryTemplate: (canonicalName, days) =>
      `KitchenMind detected ${canonicalName} is depleting soon (${days} days remaining). Review re-stock proposal or ask Copilot for shopping advice.`,
  },

  WORKFLOW_02: {
    workflow_id: 'WF-02-USE-SOON-RECIPE',
    name: 'Recipe Assistance for Expiring Stock',
    description: 'Finds matching recipes using expiring stock and presents cooking options before food spoils.',
    trigger_insight_types: ['USE_SOON'],
    minimum_confidence: 0.70,
    priority: 1,
    allowed_actions: ['meal.cook_now', 'meal.mark_cooked', 'planner.add_meal'],
    notification_policy: 'IMMEDIATE',
    cooldown_hours: 12,
    expiration_hours: 24,
    requires_confirmation: true,
    version: '1.0.0',
    enabled: true,
    titleTemplate: (canonicalName) => `Recipe recommendations for expiring ${canonicalName}`,
    summaryTemplate: (canonicalName) =>
      `A batch of ${canonicalName} expires soon. Select a matching recipe to cook today and avoid food waste.`,
  },

  WORKFLOW_03: {
    workflow_id: 'WF-03-DINNER-UNPLANNED-MEAL',
    name: 'Meal Assistance for Unplanned Dinner',
    description: 'Surfaces dinner ideas based on current pantry availability when no dinner is scheduled.',
    trigger_insight_types: ['DINNER_NOT_PLANNED'],
    minimum_confidence: 0.80,
    priority: 2,
    allowed_actions: ['planner.add_meal'],
    notification_policy: 'SCHEDULED',
    cooldown_hours: 12,
    expiration_hours: 12,
    requires_confirmation: true,
    version: '1.0.0',
    enabled: true,
    titleTemplate: () => "Tonight's dinner planning assistance",
    summaryTemplate: () =>
      "No dinner is planned for tonight. Choose a ready recipe to add to your meal planner or ask Copilot for suggestions.",
  },

  WORKFLOW_04: {
    workflow_id: 'WF-04-INGREDIENTS-AVAILABLE-COOK',
    name: 'Cook Assistance for 100% In-Stock Recipe',
    description: 'Highlights ready-to-cook recipes where 100% of required ingredients are in stock.',
    trigger_insight_types: ['INGREDIENTS_AVAILABLE_FOR_MEAL'],
    minimum_confidence: 0.75,
    priority: 3,
    allowed_actions: ['meal.cook_now', 'meal.mark_cooked', 'planner.add_meal'],
    notification_policy: 'SCHEDULED',
    cooldown_hours: 24,
    expiration_hours: 24,
    requires_confirmation: true,
    version: '1.0.0',
    enabled: true,
    titleTemplate: (recipeName) => `Cook assistance for ${recipeName}`,
    summaryTemplate: (recipeName) =>
      `You have 100% of ingredients in stock to cook ${recipeName}. Schedule or cook now with automatic inventory deductions.`,
  },

  WORKFLOW_05: {
    workflow_id: 'WF-05-EXPECTED-PURCHASE-SHOPPING',
    name: 'Shopping Preparation for Accumulated Low Stock',
    description: 'Consolidates multiple low stock items into a unified shopping preparation plan.',
    trigger_insight_types: ['SHOPPING_GAP', 'EXPECTED_PURCHASE'],
    minimum_confidence: 0.70,
    priority: 3,
    allowed_actions: ['inventory.add_item'],
    notification_policy: 'SCHEDULED',
    cooldown_hours: 48,
    expiration_hours: 72,
    requires_confirmation: true,
    version: '1.0.0',
    enabled: true,
    titleTemplate: (count) => `Weekly shopping preparation (${count} items low)`,
    summaryTemplate: (count) =>
      `You have ${count} low stock items accumulating. Review consolidated shopping list recommendations.`,
  },
}
