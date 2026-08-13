import { assert, assertEquals } from '@std/assert'
import { invokeToolWithBudget } from '../runtime/orchestrator.ts'
import { createMockSupabaseFrom } from './mockSupabaseClient.ts'
import type { ToolContext } from '../types.ts'

function ctx(): ToolContext {
  return { householdId: 'hh-1', client: createMockSupabaseFrom({ inventory: [] }) }
}

Deno.test('invokeToolWithBudget: a non-invocable capability is rejected without ever running (§6.3)', async () => {
  const { result } = await invokeToolWithBudget('unregistered.capability', {}, ctx())
  assertEquals(result.ok, false)
  assertEquals(result.error?.code, 'CAPABILITY_NOT_INVOCABLE')
})

Deno.test('invokeToolWithBudget: an unknown capability id degrades gracefully, never throws', async () => {
  const { result } = await invokeToolWithBudget('not.a.real.capability', {}, ctx())
  assertEquals(result.ok, false)
  assertEquals(result.error?.code, 'CAPABILITY_NOT_INVOCABLE')
})

Deno.test('invokeToolWithBudget: a real, enabled capability executes and returns a typed result', async () => {
  const { result, durationMs } = await invokeToolWithBudget('inventory.read', {}, ctx())
  assert(result.ok)
  assert(durationMs >= 0)
})

Deno.test('invokeToolWithBudget: an underlying service failure surfaces as a typed error, not a thrown exception', async () => {
  const failingCtx: ToolContext = { householdId: 'hh-1', client: createMockSupabaseFrom({ inventory: [] }, { failTables: ['inventory'] }) }
  const { result } = await invokeToolWithBudget('inventory.read', {}, failingCtx)
  assertEquals(result.ok, false)
  assert(result.error?.code)
})
