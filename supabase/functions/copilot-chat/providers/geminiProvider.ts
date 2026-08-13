// Gemini provider — the default/primary LLM provider (§7.6: single capable provider, no
// router). Reuses the same Google Generative Language API the existing OCR pipeline
// (src/lib/gemini.js) already calls, just the streaming + function-calling surface instead of
// one-shot generateContent.
//
// Wire format verified against the live API during implementation (not assumed from docs):
//   - streamGenerateContent?alt=sse returns `data: {...}` SSE chunks shaped like the non-streaming
//     response, split across chunks.
//   - `gemini-2.5-flash` (the model src/lib/gemini.js hardcodes) 404s for this account with
//     "no longer available to new users" — the `gemini-flash-latest` alias is used here instead
//     specifically so this provider doesn't silently break the way a hardcoded dated model would.
//   - Tool-calling responses require echoing back an opaque `thoughtSignature` string attached to
//     the functionCall part on any subsequent turn that replays it, or the API 400s ("Function
//     call is missing a thought_signature"). This is threaded through via ProviderMessage.
//     providerMeta (types.ts) so no other module needs to know Gemini has this quirk.
//   - functionResponse parts are sent back under role 'user', not 'tool'/'function' — confirmed
//     by a successful live round trip, not assumed from older API docs.
import type { LLMProvider, ProviderMessage, ProviderStreamEvent, ProviderToolSpec } from '../types.ts'

const DEFAULT_MODEL = 'gemini-flash-latest'

// deno-lint-ignore no-explicit-any
function toGeminiSchema(schema: Record<string, any>): Record<string, any> {
  if (!schema || typeof schema !== 'object') return schema
  const out: Record<string, unknown> = {}
  if (schema.type) out.type = String(schema.type).toUpperCase()
  if (schema.description) out.description = schema.description
  if (schema.enum) out.enum = schema.enum
  if (schema.minimum !== undefined) out.minimum = schema.minimum
  if (schema.maximum !== undefined) out.maximum = schema.maximum
  if (schema.required) out.required = schema.required
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v as Record<string, unknown>)])
    )
  }
  if (schema.items) out.items = toGeminiSchema(schema.items)
  // Gemini's function-declaration schema subset does not support additionalProperties — omitted
  // deliberately rather than passed through and risking a 400.
  return out
}

function toFunctionDeclarations(tools: ProviderToolSpec[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.inputSchema),
  }))
}

interface GeminiContent {
  role: 'user' | 'model'
  // deno-lint-ignore no-explicit-any
  parts: any[]
}

function toGeminiContents(messages: ProviderMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = []
  for (const m of messages) {
    if (m.role === 'system') continue // carried separately as systemInstruction
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] })
    } else if (m.role === 'assistant' && m.toolName) {
      // deno-lint-ignore no-explicit-any
      const part: any = { functionCall: { name: m.toolName, args: m.toolInput ?? {} } }
      if (m.providerMeta) part.thoughtSignature = m.providerMeta
      contents.push({ role: 'model', parts: [part] })
    } else if (m.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: m.content }] })
    } else if (m.role === 'tool') {
      let response: unknown
      try {
        response = JSON.parse(m.content)
      } catch {
        response = { result: m.content }
      }
      contents.push({ role: 'user', parts: [{ functionResponse: { name: m.toolName ?? 'unknown_tool', response } }] })
    }
  }
  return contents
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
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
      const jsonStr = line.slice(5).trim()
      if (!jsonStr) continue
      try {
        yield JSON.parse(jsonStr)
      } catch {
        // Malformed/partial chunk — skip rather than crash the whole stream over one bad line.
      }
    }
  }
}

export function createGeminiProvider(opts: { apiKey: string; model?: string }): LLMProvider {
  const model = opts.model || DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`

  return {
    name: `gemini:${model}`,
    async *streamChat({ system, messages, tools, signal }) {
      const body = {
        contents: toGeminiContents(messages),
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        tools: tools.length > 0 ? [{ functionDeclarations: toFunctionDeclarations(tools) }] : undefined,
        generationConfig: { temperature: 0.2 },
      }

      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`Gemini request timed out (PROVIDER_TIMEOUT)`)
        }
        throw err
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 300)}`)
      }

      let sawFunctionCall = false
      let finishReason: string | undefined
      let usage: { inputTokens: number; outputTokens: number } | undefined

      for await (const chunk of parseSSE(res.body)) {
        // deno-lint-ignore no-explicit-any
        const candidate = (chunk as any)?.candidates?.[0]
        const parts = candidate?.content?.parts ?? []
        for (const part of parts) {
          if (part.functionCall) {
            sawFunctionCall = true
            const event: ProviderStreamEvent = {
              type: 'tool_call',
              toolCallId: part.functionCall.id || crypto.randomUUID(),
              toolName: part.functionCall.name,
              input: part.functionCall.args ?? {},
              providerMeta: part.thoughtSignature,
            }
            yield event
          } else if (typeof part.text === 'string' && part.text.length > 0) {
            yield { type: 'text_delta', delta: part.text }
          }
        }
        if (candidate?.finishReason) finishReason = candidate.finishReason
        // deno-lint-ignore no-explicit-any
        const meta = (chunk as any)?.usageMetadata
        if (meta) usage = { inputTokens: meta.promptTokenCount ?? 0, outputTokens: meta.candidatesTokenCount ?? 0 }
      }

      if (usage) yield { type: 'usage', inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }

      const stopReason = sawFunctionCall
        ? 'tool_use'
        : finishReason === 'MAX_TOKENS'
          ? 'max_tokens'
          : 'end_turn'
      yield { type: 'done', stopReason }
    },
  }
}
