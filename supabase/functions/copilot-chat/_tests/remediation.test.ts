import { assert, assertEquals, assertFalse } from '@std/assert'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'
import { isRetryableProviderError } from '../providers/providerFactory.ts'
import { rateLimiter } from '../runtime/rateLimiter.ts'
import { invokeToolWithBudget } from '../runtime/orchestrator.ts'
import type { LLMProvider, ProviderMessage, ProviderStreamEvent, ProviderToolSpec, ToolContext } from '../types.ts'

Deno.test('capabilityRegistry: entries support token_budget, max_rows, timeout_ms, parallel_safe, priority', () => {
  const inv = capabilityRegistry.resolve('inventory.read')
  assert(inv !== undefined)
  assertEquals(inv.token_budget, 1500)
  assertEquals(inv.max_rows, 50)
  assertEquals(inv.timeout_ms, 2000)
  assertEquals(inv.parallel_safe, true)
  assertEquals(inv.priority, 1)
})

Deno.test('invokeToolWithBudget: write capabilities require confirmation and return structured ActionProposal preview', async () => {
  assert(capabilityRegistry.requiresConfirmation('meal.mark_cooked'))
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: 'log-1', date: '2026-08-11', meal_type: 'dinner', headcount: 2, recipes: { id: 'r-1', name: 'Dal Tadka' } },
                error: null,
              }),
          }),
        }),
      }),
    }),
  }
  const ctx: ToolContext = { householdId: 'hh-1', client: mockClient }
  const res = await invokeToolWithBudget('meal.mark_cooked', { mealLogId: 'log-1' }, ctx)
  assertEquals(res.result.ok, true)
  assert(res.result.data)
  assertEquals((res.result.data as { capabilityId: string }).capabilityId, 'meal.mark_cooked')
})

Deno.test('providerFactory: isRetryableProviderError correctly classifies errors', () => {
  assert(isRetryableProviderError(new Error('LLM provider request failed (429): Rate limit')))
  assert(isRetryableProviderError(new Error('LLM provider request failed (503): Service Unavailable')))
  assert(isRetryableProviderError(new Error('PROVIDER_TIMEOUT: Request exceeded deadline')))
  assert(isRetryableProviderError(new Error('TypeError: Failed to fetch')))

  assertFalse(isRetryableProviderError(new Error('LLM provider request failed (401): Unauthorized')))
  assertFalse(isRetryableProviderError(new Error('LLM provider request failed (400): Invalid request')))
  assertFalse(isRetryableProviderError(new Error('COPILOT_LLM_PROVIDER=gemini but no GEMINI_API_KEY is configured')))
})

Deno.test('rateLimiter: enforces turn rate limit per household and resets', () => {
  rateLimiter.reset()
  const householdId = 'hh-rate-test'

  // Send 10 turns (configured max per minute)
  for (let i = 0; i < 10; i++) {
    assertFalse(rateLimiter.isRateLimited(householdId))
  }

  // 11th turn should be rate limited
  assert(rateLimiter.isRateLimited(householdId))

  // Reset clears state
  rateLimiter.reset()
  assertFalse(rateLimiter.isRateLimited(householdId))
})

class SlowMockProvider implements LLMProvider {
  name = 'slow-mock'
  async *streamChat(args: {
    system: string
    messages: ProviderMessage[]
    tools: ProviderToolSpec[]
    signal?: AbortSignal
  }): AsyncGenerator<ProviderStreamEvent> {
    if (args.signal?.aborted) throw new Error('PROVIDER_TIMEOUT')
    yield { type: 'text_delta', delta: 'Slow response' }
    yield { type: 'done', stopReason: 'end_turn' }
  }
}

Deno.test('SlowMockProvider: respects signal parameter', async () => {
  const controller = new AbortController()
  controller.abort()
  const provider = new SlowMockProvider()
  let caught = false
  try {
    for await (const _ev of provider.streamChat({ system: '', messages: [], tools: [], signal: controller.signal })) {
      // should not reach
    }
  } catch (err) {
    caught = true
    assert(err instanceof Error && err.message.includes('PROVIDER_TIMEOUT'))
  }
  assert(caught)
})
