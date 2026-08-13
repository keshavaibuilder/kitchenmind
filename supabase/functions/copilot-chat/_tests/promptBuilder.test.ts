import { assert, assertEquals } from '@std/assert'
import { buildPrompt, estimateTokens } from '../runtime/promptBuilder.ts'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'
import type { BaseContext } from '../runtime/contextAssembler.ts'

const baseContext: BaseContext = {
  householdName: 'Test Household',
  memberCount: 4,
  pantryHealthScore: 80,
  pantryHealthLabel: 'Great',
  lowStockCount: 2,
  todaysMeals: [{ meal_type: 'dinner', status: 'planned' }],
  asOf: '2026-08-09T10:00:00Z',
}

function build(userTurn = 'What should I cook tonight?') {
  return buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs: capabilityRegistry.toProviderToolSpecs(),
    baseContext,
    history: [],
    userTurn,
    maxContextTokens: 6000,
  })
}

Deno.test('buildPrompt produces deterministic output for identical input', () => {
  const a = build()
  const b = build()
  assertEquals(a.system, b.system)
  assertEquals(a.cacheableSystemPrefix, b.cacheableSystemPrefix)
})

Deno.test('cacheableSystemPrefix is a strict prefix of the full system prompt (§7.4)', () => {
  const built = build()
  assert(built.system.startsWith(built.cacheableSystemPrefix))
})

Deno.test('cacheableSystemPrefix does not change when only household context changes (§4.1 block ordering)', () => {
  const a = build()
  const differentContext: BaseContext = { ...baseContext, lowStockCount: 99, pantryHealthScore: 10 }
  const b = buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs: capabilityRegistry.toProviderToolSpecs(),
    baseContext: differentContext,
    history: [],
    userTurn: 'What should I cook tonight?',
    maxContextTokens: 6000,
  })
  assertEquals(a.cacheableSystemPrefix, b.cacheableSystemPrefix)
  assert(a.system !== b.system) // the dynamic block 3 does differ
})

Deno.test('exceedsBudget flips true once the estimate crosses maxContextTokens', () => {
  const small = buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs: capabilityRegistry.toProviderToolSpecs(),
    baseContext,
    history: [],
    userTurn: 'hi',
    maxContextTokens: 6000,
  })
  assert(!small.exceedsBudget)

  const tiny = buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs: capabilityRegistry.toProviderToolSpecs(),
    baseContext,
    history: [],
    userTurn: 'hi',
    maxContextTokens: 10, // deliberately below even the static blocks
  })
  assert(tiny.exceedsBudget)
})

Deno.test('estimateTokens is a monotonic, deterministic approximation', () => {
  assert(estimateTokens('a'.repeat(400)) > estimateTokens('a'.repeat(40)))
  assertEquals(estimateTokens('test'), estimateTokens('test'))
})

Deno.test('messages array ends with the current user turn', () => {
  const built = build('Can I make paneer butter masala today?')
  const last = built.messages.at(-1)
  assertEquals(last?.role, 'user')
  assertEquals(last?.content, 'Can I make paneer butter masala today?')
})
