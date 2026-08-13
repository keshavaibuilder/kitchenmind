// SambaNova — OpenAI-compatible endpoint, documented at https://api.sambanova.ai/v1. See
// openAiCompatibleProvider.ts's module header: NOT live-verified in this environment (no API key
// available). Confirm the default model is still current in SambaNova's model list before
// relying on it in production.
import { createOpenAiCompatibleProvider } from './openAiCompatibleProvider.ts'
import type { LLMProvider } from '../types.ts'

const DEFAULT_MODEL = 'Meta-Llama-3.3-70B-Instruct'

export function createSambaNovaProvider(opts: { apiKey: string; model?: string }): LLMProvider {
  return createOpenAiCompatibleProvider({
    providerName: 'sambanova',
    baseUrl: 'https://api.sambanova.ai/v1',
    apiKey: opts.apiKey,
    model: opts.model || DEFAULT_MODEL,
  })
}
