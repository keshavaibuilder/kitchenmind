import { assert, assertEquals } from '@std/assert'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'
import { markMealCookedTool } from '../tools/markMealCookedTool.ts'
import { cookRecipeNowTool } from '../tools/cookRecipeNowTool.ts'
import { planMealTool } from '../tools/planMealTool.ts'
import { addInventoryItemTool } from '../tools/addInventoryItemTool.ts'
import type { ToolContext } from '../types.ts'

Deno.test('capabilityRegistry: registers and enables 6 write capabilities (§6.3/§6.4)', () => {
  const writeCaps = capabilityRegistry.listAll().filter((c) => c.access_class === 'write')
  assertEquals(writeCaps.length, 6)

  const ids = writeCaps.map((c) => c.capability_id)
  assert(ids.includes('meal.mark_cooked'))
  assert(ids.includes('meal.cook_now'))
  assert(ids.includes('planner.add_meal'))
  assert(ids.includes('inventory.add_item'))

  for (const cap of writeCaps) {
    assertEquals(cap.enabled, true)
    assertEquals(cap.access_class, 'write')
    assertEquals(capabilityRegistry.requiresConfirmation(cap.capability_id), true)
  }
})

Deno.test('markMealCookedTool: generates structured ActionProposal for existing meal_log', async () => {
  const mockClient = {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: 'ml-1', date: '2026-08-11', meal_type: 'dinner', headcount: 2, status: 'planned', recipes: { id: 'r-1', name: 'Dal Tadka' } },
                error: null,
              }),
          }),
        }),
      }),
    }),
  }

  const ctx: ToolContext = { householdId: 'hh-1', client: mockClient }
  const res = await markMealCookedTool({ mealLogId: 'ml-1' }, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'meal.mark_cooked')
  assertEquals(res.data.actionName, 'Mark Meal as Cooked')
  assertEquals(res.data.preview.irreversible, true)
})

Deno.test('cookRecipeNowTool: generates structured ActionProposal for recipe cook now', async () => {
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: 'r-10', name: 'Paneer Butter Masala', servings: 2, recipe_ingredients: [{ canonical_name: 'Paneer' }] },
              error: null,
            }),
        }),
      }),
    }),
  }

  const ctx: ToolContext = { householdId: 'hh-1', client: mockClient }
  const res = await cookRecipeNowTool({ recipeId: 'r-10', servings: 4, mealType: 'dinner' }, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'meal.cook_now')
  assertEquals(res.data.payload.servings, 4)
  assertEquals(res.data.preview.affectedItems[0], 'Paneer Butter Masala')
})

Deno.test('planMealTool: generates structured ActionProposal for scheduling meal', async () => {
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: 'r-5', name: 'Rajma Chawal' },
              error: null,
            }),
        }),
      }),
    }),
  }

  const ctx: ToolContext = { householdId: 'hh-1', client: mockClient }
  const res = await planMealTool({ recipeId: 'r-5', date: '2026-08-15', mealType: 'lunch', headcount: 3 }, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'planner.add_meal')
  assertEquals(res.data.preview.irreversible, false)
})

Deno.test('addInventoryItemTool: generates structured ActionProposal for adding inventory stock', async () => {
  const ctx: ToolContext = { householdId: 'hh-1', client: {} }
  const res = await addInventoryItemTool({ canonicalName: 'Basmati Rice', quantityGrams: 1000, category: 'Grains' }, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'inventory.add_item')
  assertEquals(res.data.payload.quantityGrams, 1000)
})
