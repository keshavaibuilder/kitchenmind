import { assert, assertEquals } from '@std/assert'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'
import { memoryReadTool } from '../tools/memoryReadTool.ts'
import { memorySaveTool } from '../tools/memorySaveTool.ts'
import { memoryDeleteTool } from '../tools/memoryDeleteTool.ts'
import { buildPrompt } from '../runtime/promptBuilder.ts'
import type { BaseContext } from '../runtime/contextAssembler.ts'
import type { ToolContext } from '../types.ts'

Deno.test('capabilityRegistry: registers and enables 3 memory capabilities (§5.4)', () => {
  const memCaps = capabilityRegistry.listAll().filter((c) => c.capability_id.startsWith('memory.'))
  assertEquals(memCaps.length, 3)

  const ids = memCaps.map((c) => c.capability_id)
  assert(ids.includes('memory.read'))
  assert(ids.includes('memory.save'))
  assert(ids.includes('memory.delete'))

  assertEquals(capabilityRegistry.requiresConfirmation('memory.read'), false)
  assertEquals(capabilityRegistry.requiresConfirmation('memory.save'), true)
  assertEquals(capabilityRegistry.requiresConfirmation('memory.delete'), true)
})

Deno.test('memoryReadTool: reads active household memories from Supabase client', async () => {
  const mockClient = {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            or: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'm-1',
                        household_id: 'hh-1',
                        memory_type: 'preference',
                        memory_key: 'spiciness',
                        memory_value: 'No spicy food',
                        source: 'user_explicit',
                        confidence: 1.0,
                        status: 'active',
                        created_at: '2026-08-10T00:00:00Z',
                        updated_at: '2026-08-10T00:00:00Z',
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    }),
  }

  const ctx: ToolContext = { householdId: 'hh-1', client: mockClient }
  const res = await memoryReadTool({}, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.count, 1)
  assertEquals(res.data.memories[0].memory_key, 'spiciness')
})

Deno.test('memorySaveTool: generates structured ActionProposal for saving explicit memory', async () => {
  const ctx: ToolContext = { householdId: 'hh-1', client: {} }
  const res = await memorySaveTool(
    { memoryKey: 'weekday_breakfast', memoryValue: 'Quick 15-min breakfasts', memoryType: 'preference' },
    ctx
  )

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'memory.save')
  assertEquals(res.data.payload.memoryKey, 'weekday_breakfast')
  assertEquals(res.data.preview.affectedItems[0], 'weekday_breakfast')
})

Deno.test('memoryDeleteTool: generates structured ActionProposal for deleting memory', async () => {
  const ctx: ToolContext = { householdId: 'hh-1', client: {} }
  const res = await memoryDeleteTool({ memoryId: 'm-99', memoryKey: 'spiciness' }, ctx)

  assertEquals(res.ok, true)
  assert(res.data)
  assertEquals(res.data.capabilityId, 'memory.delete')
  assertEquals(res.data.payload.memoryKey, 'spiciness')
})

Deno.test('buildPrompt: injects Explicit Household Copilot Memories block into system prompt', () => {
  const baseCtx: BaseContext = {
    householdName: 'Smith Family',
    memberCount: 3,
    pantryHealthScore: 85,
    pantryHealthLabel: 'Healthy',
    lowStockCount: 1,
    todaysMeals: [],
    activeMemories: [
      { memory_type: 'preference', memory_key: 'quick_breakfast', memory_value: 'Prefers quick breakfasts', source: 'user_explicit' },
    ],
    asOf: new Date().toISOString(),
  }

  const built = buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs: capabilityRegistry.toProviderToolSpecs(),
    baseContext: baseCtx,
    history: [],
    userTurn: 'What should I cook for breakfast?',
    maxContextTokens: 4000,
  })

  assert(built.system.includes('Explicit Household Copilot Memories:'))
  assert(built.system.includes('- [PREFERENCE] quick_breakfast: "Prefers quick breakfasts"'))
  assert(built.system.includes('Knowledge Precedence & Domain Rules:'))
})
