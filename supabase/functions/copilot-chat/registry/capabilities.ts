// The versioned Capability Registry data (§3.1). A static, versioned config loaded at cold
// start — per the frozen design, "no new database table required for Sprint 6B."
//
// `description` here is not incidental — it IS the text injected into the system prompt's tool
// catalogue block (§4.1 block 2, §4.3). Keep it accurate to the tool's real behavior, since the
// LLM's tool-selection quality depends entirely on this field.
import type { CapabilityEntry, ProviderToolSpec } from '../types.ts'

// deno-lint-ignore no-explicit-any
type JSONSchema = Record<string, any>

interface RegistryRow {
  entry: CapabilityEntry
  inputSchema: JSONSchema
}

const ROWS: RegistryRow[] = [
  {
    entry: {
      capability_id: 'inventory.read',
      description:
        'Read the household\'s current inventory: item names, quantities in grams, display units, and low-stock thresholds. Use for "what do I have", "what\'s running low", or as an availability check paired with recipe.search.',
      bound_tool: 'InventoryTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['inventory', 'inventory_batches'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1500,
      max_rows: 50,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 1,
    },
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            lowStockOnly: { type: 'boolean' },
            category: { type: 'string' },
          },
          additionalProperties: false,
        },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'prediction.read',
      description:
        'Read depletion predictions: days remaining, predicted depletion date, low-stock risk, and confidence, derived from purchase velocity. Use for "how long will X last" or "what will run out soon". Note: velocity reflects purchase cadence, not cooking/eating rate.',
      bound_tool: 'PredictionTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['prediction_cache', 'household_learning_profile'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1000,
      max_rows: 50,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 2,
    },
    inputSchema: {
      type: 'object',
      properties: {
        canonical_name: { type: 'string', description: 'Optional single-ingredient filter' },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'recipe.search',
      description:
        'Search the recipe catalogue (global + household custom recipes) by name/meal type, optionally checking current inventory availability (canCookNow) to report missing ingredients and shortfall. Never invents a recipe outside this catalogue.',
      bound_tool: 'RecipeTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['recipes', 'inventory'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1500,
      max_rows: 10,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 3,
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        canCookNow: { type: 'boolean', description: 'If true, cross-checks ingredients against current inventory' },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'planner.plan',
      description:
        'Get today\'s suggested meal plan or a week preview, with the disclosed score+reasons behind each suggestion. Use for "what should I cook".',
      bound_tool: 'PlannerTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: [
        'recipes', 'inventory', 'inventory_batches', 'prediction_cache',
        'ingredient_consumption_profile', 'household_learning_profile', 'preferences', 'meal_log',
      ],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 2000,
      max_rows: 20,
      timeout_ms: 3000,
      parallel_safe: true,
      priority: 4,
    },
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['today', 'week'] },
      },
      required: ['scope'],
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'shopping.suggestions',
      description:
        'Get shopping suggestions (what to buy, why, and urgency) derived from depletion predictions and any ingredient gaps in already-planned meals. Use for "what should I buy this weekend".',
      bound_tool: 'ShoppingTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: [
        'recipes', 'inventory', 'inventory_batches', 'prediction_cache',
        'ingredient_consumption_profile', 'household_learning_profile', 'preferences', 'meal_log',
      ],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 1500,
      max_rows: 30,
      timeout_ms: 3000,
      parallel_safe: true,
      priority: 5,
    },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    entry: {
      capability_id: 'observation.recent',
      description:
        'Read the recent AI observation timeline: new ingredients discovered, unusual purchase quantities, duplicate purchases, pantry-diversity milestones. Use for "what\'s new" or "anything unusual lately".',
      bound_tool: 'ObservationTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['ai_observations'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1000,
      max_rows: 50,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 6,
    },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'meal_history.read',
      description:
        'Read cooked meal history (what, when, for how many) and, given a specific meal, its ingredient-level stock deductions. Use for "what have we been cooking" or "how much rice did that use".',
      bound_tool: 'MealHistoryTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['meal_log', 'stock_deductions'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1500,
      max_rows: 50,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 7,
    },
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        mealLogId: { type: 'string', description: 'If set, also returns stock deductions for this specific cooked meal' },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'household.profile',
      description:
        'Read household-level intelligence: pantry diversity score, top categories, shopping frequency/preferred day, per-ingredient consumption profiles, and a coarse month-over-month spend total from bills. Use for "why has my spending increased" (coarse only — no category breakdown yet) or general household trend questions.',
      bound_tool: 'HouseholdProfileTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['household_learning_profile', 'ingredient_consumption_profile', 'bills'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1000,
      max_rows: 30,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 8,
    },
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'number', minimum: 1, maximum: 12, default: 3 },
      },
      additionalProperties: false,
    },
  },
  {
    // Sprint 6D — Confirmation-gated action execution capabilities (§6.3/§6.4).
    // Bound tools produce a structured ActionProposal for user confirmation.
    entry: {
      capability_id: 'meal.mark_cooked',
      description: 'Propose marking a planned meal as cooked with atomic FIFO inventory deduction via mark_meal_cooked() RPC.',
      bound_tool: 'MarkMealCookedTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['meal_log', 'inventory_batches', 'stock_deductions'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 500,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 9,
    },
    inputSchema: {
      type: 'object',
      properties: {
        mealLogId: { type: 'string', description: 'ID of the planned meal log row' },
      },
      required: ['mealLogId'],
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'meal.cook_now',
      description: 'Propose cooking a selected recipe immediately (creates a planned meal and prepares inventory deduction).',
      bound_tool: 'CookRecipeNowTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['recipes', 'inventory', 'meal_log'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 600,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 10,
    },
    inputSchema: {
      type: 'object',
      properties: {
        recipeId: { type: 'string', description: 'Recipe UUID to cook' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        servings: { type: 'number', minimum: 1, default: 1 },
      },
      required: ['recipeId'],
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'planner.add_meal',
      description: 'Propose scheduling a meal in the meal planner for a specified date and meal type.',
      bound_tool: 'PlanMealTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['recipes', 'meal_log'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 500,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 11,
    },
    inputSchema: {
      type: 'object',
      properties: {
        recipeId: { type: 'string', description: 'Recipe UUID to schedule' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        headcount: { type: 'number', minimum: 1, default: 1 },
        notes: { type: 'string' },
      },
      required: ['recipeId', 'date', 'mealType'],
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'inventory.add_item',
      description: 'Propose adding or updating pantry inventory stock with display units and low-stock threshold.',
      bound_tool: 'AddInventoryItemTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['inventory', 'inventory_batches'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 500,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 12,
    },
    inputSchema: {
      type: 'object',
      properties: {
        canonicalName: { type: 'string', description: 'Ingredient canonical name' },
        quantityGrams: { type: 'number', minimum: 1, description: 'Quantity in grams to add' },
        category: { type: 'string' },
        lowStockThresholdGrams: { type: 'number' },
      },
      required: ['canonicalName', 'quantityGrams'],
      additionalProperties: false,
    },
  },
  {
    // Sprint 6E — Long-Term Memory Capabilities
    entry: {
      capability_id: 'memory.read',
      description: 'Read active household Copilot memories: explicitly remembered preferences, restrictions, habits, instructions, and context.',
      bound_tool: 'MemoryReadTool',
      access_class: 'read',
      household_scope: 'injected',
      data_sources: ['copilot_memory'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 2000,
      enabled: true,
      token_budget: 1000,
      max_rows: 30,
      timeout_ms: 2000,
      parallel_safe: true,
      priority: 13,
    },
    inputSchema: {
      type: 'object',
      properties: {
        memoryType: { type: 'string', enum: ['preference', 'restriction', 'habit', 'instruction', 'context'] },
      },
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'memory.save',
      description: 'Propose saving an explicit household memory when the user explicitly asks to remember a preference, restriction, habit, or instruction.',
      bound_tool: 'MemorySaveTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['copilot_memory'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 500,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 14,
    },
    inputSchema: {
      type: 'object',
      properties: {
        memoryKey: { type: 'string', description: 'Short unique topic key, e.g. weekday_breakfast' },
        memoryValue: { type: 'string', description: 'Clear explicit memory statement, e.g. Prefers quick 15-minute breakfasts on weekdays' },
        memoryType: { type: 'string', enum: ['preference', 'restriction', 'habit', 'instruction', 'context'], default: 'preference' },
        expiresAt: { type: 'string', description: 'Optional ISO expiration timestamp for temporary memory' },
      },
      required: ['memoryKey', 'memoryValue'],
      additionalProperties: false,
    },
  },
  {
    entry: {
      capability_id: 'memory.delete',
      description: 'Propose deleting an existing household memory when the user explicitly asks to forget or remove a remembered item.',
      bound_tool: 'MemoryDeleteTool',
      access_class: 'write',
      household_scope: 'injected',
      data_sources: ['copilot_memory'],
      version: '1.0.0',
      deprecated_at: null,
      perf_budget_ms: 3000,
      enabled: true,
      token_budget: 500,
      max_rows: 1,
      timeout_ms: 3000,
      parallel_safe: false,
      priority: 15,
    },
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'UUID of the memory entry to delete' },
        memoryKey: { type: 'string', description: 'Key of the memory entry to delete' },
      },
      additionalProperties: false,
    },
  },
]

// ── Registration-time invariants (§3.1, §6.1) ──────────────────────────────
function assertNoHouseholdScopeLeak(row: RegistryRow) {
  const props = Object.keys(row.inputSchema?.properties ?? {})
  const leaked = props.find((p) => /household/i.test(p))
  if (leaked) {
    throw new Error(
      `Capability Registry invariant violated: "${row.entry.capability_id}" input schema exposes ` +
      `"${leaked}" — household_id must always be server-injected (§3.1), never LLM-suppliable.`
    )
  }
}

function assertNoDuplicateCapabilityId(rows: readonly RegistryRow[]) {
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.entry.capability_id)) {
      throw new Error(`Capability Registry invariant violated: duplicate capability_id "${row.entry.capability_id}"`)
    }
    seen.add(row.entry.capability_id)
  }
}

for (const row of ROWS) assertNoHouseholdScopeLeak(row)
assertNoDuplicateCapabilityId(ROWS)

export const REGISTRY_ROWS: readonly RegistryRow[] = ROWS

export function toProviderToolSpec(row: RegistryRow): ProviderToolSpec {
  return {
    name: row.entry.capability_id,
    description: row.entry.description,
    inputSchema: row.inputSchema,
  }
}
