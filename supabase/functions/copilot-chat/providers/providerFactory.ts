import type { LLMProvider, ProviderMessage, ProviderStreamEvent, ProviderToolSpec } from '../types.ts'
import { config } from '../config.ts'
import { createGeminiProvider } from './geminiProvider.ts'
import { createGroqProvider } from './groqProvider.ts'
import { createSambaNovaProvider } from './sambanovaProvider.ts'
import { emitFailoverTelemetry } from '../runtime/telemetry.ts'

export function isRetryableProviderError(err: unknown): boolean {
  if (!err) return false
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()

  // Retryable: Timeout, HTTP 429, Temporary 5xx, Network/Fetch failure
  if (
    msg.includes('timeout') ||
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  ) {
    return true
  }

  if (/request failed \((429|500|502|503|504)\)/.test(msg)) {
    return true
  }

  // Do NOT retry: 400, 401, 403, 404, 422, unauthenticated, invalid request, unsupported model
  return false
}

class FailoverProvider implements LLMProvider {
  #providers: LLMProvider[]

  constructor(providers: LLMProvider[]) {
    this.#providers = providers
  }

  get name(): string {
    return this.#providers.map((p) => p.name).join('->')
  }

  async *streamChat(args: {
    system: string
    messages: ProviderMessage[]
    tools: ProviderToolSpec[]
    signal?: AbortSignal
  }): AsyncGenerator<ProviderStreamEvent> {
    let lastErr: unknown = null

    for (let i = 0; i < this.#providers.length; i++) {
      const provider = this.#providers[i]
      try {
        for await (const ev of provider.streamChat(args)) {
          yield ev
        }
        return // Succeeded
      } catch (err) {
        lastErr = err
        const isRetryable = isRetryableProviderError(err)
        const nextProvider = this.#providers[i + 1]

        if (isRetryable && nextProvider) {
          emitFailoverTelemetry({
            requestId: 'failover',
            fromProvider: provider.name,
            toProvider: nextProvider.name,
            error: err instanceof Error ? err.message : String(err),
          })
          continue // Try next provider in chain
        }

        throw err // Non-retryable or no remaining provider
      }
    }

    throw lastErr || new Error('All providers failed')
  }
}

export function createProvider(): LLMProvider {
  const selected = config.llm.provider.toLowerCase()

  const providerCreators: Record<string, () => LLMProvider | null> = {
    gemini: () => {
      const apiKey = config.llm.geminiApiKey()
      return apiKey ? createGeminiProvider({ apiKey, model: config.llm.model || undefined }) : null
    },
    groq: () => {
      const apiKey = config.llm.groqApiKey()
      return apiKey ? createGroqProvider({ apiKey, model: config.llm.model || undefined }) : null
    },
    sambanova: () => {
      const apiKey = config.llm.sambanovaApiKey()
      return apiKey ? createSambaNovaProvider({ apiKey, model: config.llm.model || undefined }) : null
    },
  }

  if (!providerCreators[selected]) {
    throw new Error(
      `Unknown COPILOT_LLM_PROVIDER "${selected}". Supported: gemini, groq, sambanova.`
    )
  }

  const primary = providerCreators[selected]()
  if (!primary) {
    throw new Error(`COPILOT_LLM_PROVIDER=${selected} but no ${selected.toUpperCase()}_API_KEY is configured`)
  }

  const fallbackList: LLMProvider[] = [primary]

  // Add available fallbacks in deterministic order
  for (const name of ['gemini', 'groq', 'sambanova']) {
    if (name !== selected) {
      const provider = providerCreators[name]()
      if (provider) fallbackList.push(provider)
    }
  }

  if (fallbackList.length === 1) return primary
  return new FailoverProvider(fallbackList)
}
