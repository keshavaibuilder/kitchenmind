import { assert, assertEquals } from '@std/assert'
import * as conversationStore from '../runtime/conversationStore.ts'
import { createMockSupabaseFrom } from './mockSupabaseClient.ts'
import type { ToolContext } from '../types.ts'

function ctx() {
  const client = createMockSupabaseFrom({ copilot_conversations: [], copilot_messages: [], copilot_tool_calls: [] })
  const toolCtx: ToolContext = { householdId: 'hh-1', client }
  return { toolCtx, client }
}

Deno.test('getOrCreateConversation: returns the given id unchanged if one was passed', async () => {
  const { toolCtx } = ctx()
  const id = await conversationStore.getOrCreateConversation(toolCtx, 'existing-convo-id')
  assertEquals(id, 'existing-convo-id')
})

Deno.test('getOrCreateConversation: creates a new conversation scoped to the household when none is given', async () => {
  const { toolCtx, client } = ctx()
  const id = await conversationStore.getOrCreateConversation(toolCtx, null)
  assert(id)
  assertEquals(client.__store.copilot_conversations.length, 1)
  assertEquals(client.__store.copilot_conversations[0].household_id, 'hh-1')
})

Deno.test('saveMessage: persists role/content/trustVerdict/citations and returns a message id', async () => {
  const { toolCtx, client } = ctx()
  const conversationId = await conversationStore.getOrCreateConversation(toolCtx, null)
  const messageId = await conversationStore.saveMessage(toolCtx, {
    conversationId,
    role: 'assistant',
    content: 'Rice is running low.',
    trustVerdict: 'pass',
    citations: [{ tool: 'InventoryTool', source: 'inventory', asOf: '2026-08-09T10:00:00Z', summary: '1 items' }],
  })
  assert(messageId)
  const saved = client.__store.copilot_messages.find((m) => m.id === messageId)
  assert(saved)
  assertEquals(saved.role, 'assistant')
  assertEquals(saved.trust_verdict, 'pass')
  assertEquals(saved.household_id, 'hh-1')
})

Deno.test('loadRecentMessages: returns messages oldest-first, capped at the given limit', async () => {
  const { toolCtx } = ctx()
  const conversationId = await conversationStore.getOrCreateConversation(toolCtx, null)
  await conversationStore.saveMessage(toolCtx, { conversationId, role: 'user', content: 'first' })
  await conversationStore.saveMessage(toolCtx, { conversationId, role: 'assistant', content: 'second' })
  const messages = await conversationStore.loadRecentMessages(toolCtx, conversationId, 10)
  assertEquals(messages.map((m) => m.content), ['first', 'second'])
})

Deno.test('saveToolCalls: a persistence failure is swallowed, never thrown (fire-and-forget discipline)', async () => {
  const client = createMockSupabaseFrom({ copilot_tool_calls: [] }, { failTables: ['copilot_tool_calls'] })
  const toolCtx: ToolContext = { householdId: 'hh-1', client }
  // Should not throw even though the underlying insert fails.
  await conversationStore.saveToolCalls(toolCtx, 'msg-1', [
    { messageId: 'msg-1', capabilityId: 'inventory.read', toolName: 'InventoryTool', input: {}, output: {}, asOf: null, durationMs: 10, status: 'success' },
  ])
})

Deno.test('saveToolCalls: a no-op with zero records never issues a write', async () => {
  const { toolCtx, client } = ctx()
  await conversationStore.saveToolCalls(toolCtx, 'msg-1', [])
  assertEquals(client.__store.copilot_tool_calls.length, 0)
})
