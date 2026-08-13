// Shared implementation for any OpenAI-compatible Chat Completions streaming + tool-calling API.
// Groq and SambaNova both document drop-in OpenAI SDK/endpoint compatibility, so a single
// generic factory (base URL + model + API key differ) avoids duplicating the SSE/tool-call
// accumulation logic per provider — the logic itself is genuinely provider-generic, not
// Groq-specific or SambaNova-specific, so this still satisfies "no provider-specific code
// outside this layer": groqProvider.ts / sambanovaProvider.ts contain only their endpoint config.
//
// NOTE: unlike geminiProvider.ts (verified end-to-end against the live API during
// implementation), this module was written against the documented OpenAI-compatible wire format
// and has NOT been exercised against a live Groq/SambaNova endpoint in this environment — no API
// key for either was available. Flagged explicitly in docs/21_AI_COPILOT_ARCHITECTURE_AND_DESIGN.md
// so this gap isn't silently assumed away.
import type { LLMProvider, ProviderMessage, ProviderStreamEvent, ProviderToolSpec } from '../types.ts'

interface OpenAiCompatibleConfig {
  providerName: string
  baseUrl: string // e.g. https://api.groq.com/openai/v1
  apiKey: string
  model: string
}

function toOpenAiMessages(system: string, messages: ProviderMessage[]) {
  // deno-lint-ignore no-explicit-any
  const out: any[] = system ? [{ role: 'system', content: system }] : []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'assistant' && m.toolName) {
      out.push({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: m.toolCallId ?? crypto.randomUUID(),
          type: 'function',
          function: { name: m.toolName, arguments: JSON.stringify(m.toolInput ?? {}) },
        }],
      })
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content })
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

function toOpenAiTools(tools: ProviderToolSpec[]) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }))
}

async function* parseSSELines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      yield line.slice(5).trim()
    }
  }
}

interface AccumulatingToolCall {
  id: string
  name: string
  args: string
}

export function createOpenAiCompatibleProvider(cfg: OpenAiCompatibleConfig): LLMProvider {
  return {
    name: `${cfg.providerName}:${cfg.model}`,
    async *streamChat({ system, messages, tools, signal }) {
      const body = {
        model: cfg.model,
        messages: toOpenAiMessages(system, messages),
        tools: tools.length > 0 ? toOpenAiTools(tools) : undefined,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.2,
      }

      let res: Response
      try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify(body),
          signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`${cfg.providerName} request timed out (PROVIDER_TIMEOUT)`)
        }
        throw err
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        throw new Error(`${cfg.providerName} request failed (${res.status}): ${errText.slice(0, 300)}`)
      }

      // OpenAI-compatible streaming fragments tool_call arguments across many chunks, indexed by
      // position in the `tool_calls` array — must accumulate before the input is valid JSON.
      const toolCallsByIndex = new Map<number, AccumulatingToolCall>()
      let finishReason: string | undefined
      let usage: { inputTokens: number; outputTokens: number } | undefined

      for await (const raw of parseSSELines(res.body)) {
        if (!raw || raw === '[DONE]') continue
        // deno-lint-ignore no-explicit-any
        let chunk: any
        try {
          chunk = JSON.parse(raw)
        } catch {
          continue
        }

        if (chunk.usage) {
          usage = { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 }
        }

        const choice = chunk.choices?.[0]
        if (!choice) continue
        if (choice.finish_reason) finishReason = choice.finish_reason

        const delta = choice.delta ?? {}
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'text_delta', delta: delta.content }
        }
        // deno-lint-ignore no-explicit-any
        for (const tc of delta.tool_calls ?? ([] as any[])) {
          const idx = tc.index ?? 0
          const existing = toolCallsByIndex.get(idx) ?? { id: tc.id ?? crypto.randomUUID(), name: '', args: '' }
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name = tc.function.name
          if (tc.function?.arguments) existing.args += tc.function.arguments
          toolCallsByIndex.set(idx, existing)
        }
      }

      for (const tc of toolCallsByIndex.values()) {
        let input: unknown = {}
        try {
          input = tc.args ? JSON.parse(tc.args) : {}
        } catch {
          input = {}
        }
        const event: ProviderStreamEvent = { type: 'tool_call', toolCallId: tc.id, toolName: tc.name, input }
        yield event
      }

      if (usage) yield { type: 'usage', inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }

      const stopReason =
        toolCallsByIndex.size > 0 ? 'tool_use' : finishReason === 'length' ? 'max_tokens' : 'end_turn'
      yield { type: 'done', stopReason }
    },
  }
}
