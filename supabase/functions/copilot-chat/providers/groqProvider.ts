// Groq — OpenAI-compatible endpoint, documented at https://api.groq.com/openai/v1. See
// openAiCompatibleProvider.ts's module header: NOT live-verified in this environment (no API key
// available). Default model is a reasonable choice as of implementation time — confirm it's
// still current in Groq's model list before relying on it in production, since fast-moving
// inference providers rotate hosted models frequently.
import { createOpenAiCompatibleProvider } from './openAiCompatibleProvider.ts'
import type { LLMProvider } from '../types.ts'

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export function createGroqProvider(opts: { apiKey: string; model?: string }): LLMProvider {
  return createOpenAiCompatibleProvider({
    providerName: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: opts.apiKey,
    model: opts.model || DEFAULT_MODEL,
  })
}
