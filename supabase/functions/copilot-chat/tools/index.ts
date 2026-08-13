// Maps each Capability Registry entry's `bound_tool` (§3.1) to its concrete implementation
// (§3.3). This is the ONLY place that hardcodes tool wiring — the orchestrator always resolves
// through the Capability Registry (capability_id -> bound_tool -> this map), never imports a
// tool module directly.
import type { ToolFn } from '../types.ts'
import { inventoryTool } from './inventoryTool.ts'
import { predictionTool } from './predictionTool.ts'
import { recipeTool } from './recipeTool.ts'
import { plannerTool } from './plannerTool.ts'
import { shoppingTool } from './shoppingTool.ts'
import { observationTool } from './observationTool.ts'
import { mealHistoryTool } from './mealHistoryTool.ts'
import { householdProfileTool } from './householdProfileTool.ts'
import { markMealCookedTool } from './markMealCookedTool.ts'
import { cookRecipeNowTool } from './cookRecipeNowTool.ts'
import { planMealTool } from './planMealTool.ts'
import { addInventoryItemTool } from './addInventoryItemTool.ts'
import { memoryReadTool } from './memoryReadTool.ts'
import { memorySaveTool } from './memorySaveTool.ts'
import { memoryDeleteTool } from './memoryDeleteTool.ts'

export const TOOL_IMPLEMENTATIONS: Record<string, ToolFn> = {
  InventoryTool: inventoryTool as ToolFn,
  PredictionTool: predictionTool as ToolFn,
  RecipeTool: recipeTool as ToolFn,
  PlannerTool: plannerTool as ToolFn,
  ShoppingTool: shoppingTool as ToolFn,
  ObservationTool: observationTool as ToolFn,
  MealHistoryTool: mealHistoryTool as ToolFn,
  HouseholdProfileTool: householdProfileTool as ToolFn,
  MarkMealCookedTool: markMealCookedTool as ToolFn,
  CookRecipeNowTool: cookRecipeNowTool as ToolFn,
  PlanMealTool: planMealTool as ToolFn,
  AddInventoryItemTool: addInventoryItemTool as ToolFn,
  MemoryReadTool: memoryReadTool as ToolFn,
  MemorySaveTool: memorySaveTool as ToolFn,
  MemoryDeleteTool: memoryDeleteTool as ToolFn,
}
