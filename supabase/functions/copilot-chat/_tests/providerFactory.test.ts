import { assert, assertEquals, assertThrows } from '@std/assert'
import { createProvider } from '../providers/providerFactory.ts'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {}
  for (const key of Object.keys(vars)) previous[key] = Deno.env.get(key)
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
    fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

Deno.test('createProvider: throws a clear error when the selected provider has no API key configured', () => {
  withEnv({ COPILOT_LLM_PROVIDER: 'gemini', GEMINI_API_KEY: undefined, VITE_GEMINI_API_KEY: undefined }, () => {
    assertThrows(() => createProvider(), Error, 'GEMINI_API_KEY')
  })
})

Deno.test('createProvider: throws a clear error for an unknown provider name', () => {
  withEnv({ COPILOT_LLM_PROVIDER: 'not-a-real-provider' }, () => {
    assertThrows(() => createProvider(), Error, 'Unknown COPILOT_LLM_PROVIDER')
  })
})

Deno.test('createProvider: selects Groq when configured with a key', () => {
  withEnv({ COPILOT_LLM_PROVIDER: 'groq', GROQ_API_KEY: 'test-key' }, () => {
    const provider = createProvider()
    assert(provider.name.startsWith('groq:'))
  })
})

Deno.test('createProvider: selects SambaNova when configured with a key', () => {
  withEnv({ COPILOT_LLM_PROVIDER: 'sambanova', SAMBANOVA_API_KEY: 'test-key' }, () => {
    const provider = createProvider()
    assert(provider.name.startsWith('sambanova:'))
  })
})

Deno.test('createProvider: is case-insensitive on the provider name', () => {
  withEnv({ COPILOT_LLM_PROVIDER: 'GEMINI', GEMINI_API_KEY: 'test-key' }, () => {
    const provider = createProvider()
    assertEquals(provider.name.split(':')[0], 'gemini')
  })
})
