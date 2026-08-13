import { assert, assertEquals } from '@std/assert'
import { inventoryTool } from '../tools/inventoryTool.ts'
import { createMockSupabaseFrom } from './mockSupabaseClient.ts'
import type { ToolContext } from '../types.ts'

const seedInventory = [
  { household_id: 'hh-1', canonical_name: 'Rice', category: 'Staples', quantity_grams: 500, display_unit: 'g', low_stock_threshold: 1000 },
  { household_id: 'hh-1', canonical_name: 'Salt', category: 'Staples', quantity_grams: 2000, display_unit: 'g', low_stock_threshold: 500 },
  { household_id: 'hh-1', canonical_name: 'Onion', category: 'Fresh & Vegetables', quantity_grams: 300, display_unit: 'g', low_stock_threshold: 500 },
  { household_id: 'hh-2', canonical_name: 'Rice', category: 'Staples', quantity_grams: 5000, display_unit: 'g', low_stock_threshold: 1000 }, // other household
]

function ctxFor(householdId: string, opts?: Parameters<typeof createMockSupabaseFrom>[1]): ToolContext {
  return { householdId, client: createMockSupabaseFrom({ inventory: seedInventory }, opts) }
}

Deno.test('inventoryTool: returns only this household\'s items, deriving is_low_stock', async () => {
  const result = await inventoryTool({}, ctxFor('hh-1'))
  assert(result.ok)
  assertEquals(result.data!.items.length, 3)
  assert(!result.data!.items.some((i) => i.canonical_name === 'Rice' && i.quantity_grams === 5000)) // no cross-household leak
  const rice = result.data!.items.find((i) => i.canonical_name === 'Rice')!
  assertEquals(rice.is_low_stock, true) // 500 <= 1000 threshold
  const salt = result.data!.items.find((i) => i.canonical_name === 'Salt')!
  assertEquals(salt.is_low_stock, false)
})

Deno.test('inventoryTool: lowStockOnly filter', async () => {
  const result = await inventoryTool({ filter: { lowStockOnly: true } }, ctxFor('hh-1'))
  assert(result.ok)
  assertEquals(result.data!.items.map((i) => i.canonical_name).sort(), ['Onion', 'Rice'])
})

Deno.test('inventoryTool: category filter is case-insensitive', async () => {
  const result = await inventoryTool({ filter: { category: 'staples' } }, ctxFor('hh-1'))
  assert(result.ok)
  assertEquals(result.data!.items.map((i) => i.canonical_name).sort(), ['Rice', 'Salt'])
})

Deno.test('inventoryTool: empty inventory is ok:true with an empty array, not an error (§3.3)', async () => {
  const result = await inventoryTool({}, ctxFor('hh-nonexistent'))
  assert(result.ok)
  assertEquals(result.data!.items, [])
})

Deno.test('inventoryTool: a failed underlying query returns ok:false with a typed error, never throws', async () => {
  const ctx = ctxFor('hh-1', { failTables: ['inventory'] })
  const result = await inventoryTool({}, ctx)
  assertEquals(result.ok, false)
  assertEquals(result.error?.code, 'INVENTORY_TOOL_FAILED')
})

Deno.test('inventoryTool: envelope always carries asOf and source (§3.2)', async () => {
  const result = await inventoryTool({}, ctxFor('hh-1'))
  assert(typeof result.asOf === 'string' && result.asOf.length > 0)
  assertEquals(result.source, 'inventory')
})

Deno.test('inventoryTool: respects max row limit (50) and returns truncation metadata & summary', async () => {
  const largeInventory = Array.from({ length: 60 }, (_, i) => ({
    household_id: 'hh-large',
    canonical_name: `Item ${i + 1}`,
    category: 'General',
    quantity_grams: 100,
    display_unit: 'g',
    low_stock_threshold: 50,
  }))
  const ctx = { householdId: 'hh-large', client: createMockSupabaseFrom({ inventory: largeInventory }) }
  const result = await inventoryTool({}, ctx)
  assert(result.ok)
  assertEquals(result.data!.totalItems, 60)
  assertEquals(result.data!.showing, 50)
  assertEquals(result.data!.truncated, true)
  assert(result.data!.summary?.includes('Showing 50 of 60 inventory items'))
})
