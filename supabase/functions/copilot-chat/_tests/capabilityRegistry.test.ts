import { assert, assertEquals, assertFalse } from '@std/assert'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'

Deno.test('listEnabled includes enabled write and memory capabilities for Sprint 6E', () => {
  const enabled = capabilityRegistry.listEnabled()
  assert(enabled.some((c) => c.capability_id === 'meal.mark_cooked'))
  assert(enabled.some((c) => c.capability_id === 'memory.read'))
  assertEquals(enabled.length, 15) // 8 read tools + 4 write capabilities + 3 memory capabilities
})

Deno.test('listAll includes all registered capabilities', () => {
  const all = capabilityRegistry.listAll()
  assert(all.some((c) => c.capability_id === 'meal.mark_cooked'))
})

Deno.test('resolve finds a registered capability and returns undefined for an unknown one', () => {
  assertEquals(capabilityRegistry.resolve('inventory.read')?.bound_tool, 'InventoryTool')
  assertEquals(capabilityRegistry.resolve('not.a.real.capability'), undefined)
})

Deno.test('requiresConfirmation is true only for write capabilities', () => {
  assert(capabilityRegistry.requiresConfirmation('meal.mark_cooked'))
  assert(capabilityRegistry.requiresConfirmation('meal.cook_now'))
  assert(capabilityRegistry.requiresConfirmation('memory.save'))
  assertFalse(capabilityRegistry.requiresConfirmation('inventory.read'))
  assertFalse(capabilityRegistry.requiresConfirmation('memory.read'))
})

Deno.test('isInvocable is true for enabled capabilities (§6.3 Sprint 6E)', () => {
  assert(capabilityRegistry.isInvocable('meal.mark_cooked'))
  assert(capabilityRegistry.isInvocable('inventory.read'))
  assert(capabilityRegistry.isInvocable('memory.read'))
  assertFalse(capabilityRegistry.isInvocable('not.a.real.capability'))
})

Deno.test('toProviderToolSpecs exposes 15 enabled capabilities, with name/description/inputSchema', () => {
  const specs = capabilityRegistry.toProviderToolSpecs()
  assertEquals(specs.length, 15)
  assert(specs.some((s) => s.name === 'meal.mark_cooked'))
  for (const s of specs) {
    assert(typeof s.name === 'string' && s.name.length > 0)
    assert(typeof s.description === 'string' && s.description.length > 0)
    assert(typeof s.inputSchema === 'object')
  }
})

Deno.test('toProviderToolSpecs is deterministic across calls (§7.4 prompt-cache requirement)', () => {
  const a = JSON.stringify(capabilityRegistry.toProviderToolSpecs())
  const b = JSON.stringify(capabilityRegistry.toProviderToolSpecs())
  assertEquals(a, b)
})
