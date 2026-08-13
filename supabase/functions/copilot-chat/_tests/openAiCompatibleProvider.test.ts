// Unit tests for the SSE parsing / tool-call-fragment-accumulation logic against a mocked
// `fetch`, since no live Groq/SambaNova API key is available in this environment (see
// openAiCompatibleProvider.ts's module header). This proves the parsing logic is internally
// correct against the documented OpenAI-compatible wire format — it does NOT prove the real
// Groq/SambaNova endpoints match that format exactly; only geminiProvider.ts has that stronger,
// live-verified guarantee.
import { assert, assertEquals } from '@std/assert'
import { createOpenAiCompatibleProvider } from '../providers/openAiCompatibleProvider.ts'
import type { ProviderStreamEvent } from '../types.ts'

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`data: ${line}\n\n`))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

async function withMockedFetch(response: Response, fn: () => Promise<void>) {
  const original = globalThis.fetch
  // deno-lint-ignore require-await
  globalThis.fetch = async () => response
  try {
    await fn()
  } finally {
    globalThis.fetch = original
  }
}

Deno.test('accumulates a tool call whose arguments arrive fragmented across multiple chunks', async () => {
  const chunks = [
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'inventory_read', arguments: '' } }] } }] }),
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"canonical' } }] } }] }),
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '_name":"rice"}' } }] } }] }),
    JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
    '[DONE]',
  ]

  await withMockedFetch(sseResponse(chunks), async () => {
    const provider = createOpenAiCompatibleProvider({ providerName: 'test', baseUrl: 'https://example.invalid', apiKey: 'k', model: 'm' })
    const events: ProviderStreamEvent[] = []
    for await (const ev of provider.streamChat({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [] })) {
      events.push(ev)
    }
    const toolCall = events.find((e) => e.type === 'tool_call')
    assert(toolCall && toolCall.type === 'tool_call')
    assertEquals(toolCall.toolName, 'inventory_read')
    assertEquals(toolCall.input, { canonical_name: 'rice' })
    assertEquals(events.find((e) => e.type === 'done')?.type === 'done' && (events.find((e) => e.type === 'done') as { stopReason: string }).stopReason, 'tool_use')
  })
})

Deno.test('streams plain text content deltas when no tool call is made', async () => {
  const chunks = [
    JSON.stringify({ choices: [{ delta: { content: 'Rice is ' } }] }),
    JSON.stringify({ choices: [{ delta: { content: 'running low.' }, finish_reason: 'stop' }] }),
    '[DONE]',
  ]
  await withMockedFetch(sseResponse(chunks), async () => {
    const provider = createOpenAiCompatibleProvider({ providerName: 'test', baseUrl: 'https://example.invalid', apiKey: 'k', model: 'm' })
    let text = ''
    let stopReason = ''
    for await (const ev of provider.streamChat({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [] })) {
      if (ev.type === 'text_delta') text += ev.delta
      if (ev.type === 'done') stopReason = ev.stopReason
    }
    assertEquals(text, 'Rice is running low.')
    assertEquals(stopReason, 'end_turn')
  })
})

Deno.test('captures usage from the final chunk when stream_options.include_usage is honored', async () => {
  const chunks = [
    JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
    JSON.stringify({ choices: [], usage: { prompt_tokens: 42, completion_tokens: 7 } }),
    '[DONE]',
  ]
  await withMockedFetch(sseResponse(chunks), async () => {
    const provider = createOpenAiCompatibleProvider({ providerName: 'test', baseUrl: 'https://example.invalid', apiKey: 'k', model: 'm' })
    let usage: { inputTokens: number; outputTokens: number } | undefined
    for await (const ev of provider.streamChat({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [] })) {
      if (ev.type === 'usage') usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens }
    }
    assertEquals(usage, { inputTokens: 42, outputTokens: 7 })
  })
})

Deno.test('a non-OK response throws with the provider name and status in the message', async () => {
  const errorResponse = new Response('rate limited', { status: 429 })
  await withMockedFetch(errorResponse, async () => {
    const provider = createOpenAiCompatibleProvider({ providerName: 'groq', baseUrl: 'https://example.invalid', apiKey: 'k', model: 'm' })
    let threw = false
    try {
      for await (const _ev of provider.streamChat({ system: 's', messages: [], tools: [] })) { /* drain */ }
    } catch (err) {
      threw = true
      assert(err instanceof Error)
      assert(err.message.includes('groq'))
      assert(err.message.includes('429'))
    }
    assert(threw)
  })
})
