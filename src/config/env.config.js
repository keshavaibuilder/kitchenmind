/**
 * Centralized Environment Configuration
 * Validates and exposes environment variables required by KitchenMind.
 */

export const isViteContext = typeof import.meta !== 'undefined' && Boolean(import.meta.env)
const metaEnv = isViteContext ? import.meta.env : {}

// `process` does not exist as a global in a Vite browser bundle — only guard-check it the same
// way isViteContext guards `import.meta`, never reference the bare identifier unconditionally.
// Previously `metaEnv.VITE_X || process.env.VITE_X || ''` relied on `metaEnv.VITE_X` always being
// truthy (so `||` short-circuited before touching `process`) — silently correct only because
// every var read this way happened to always be set in .env. The first genuinely optional var
// (VITE_GEMINI_OCR_MODELS, unset by default) exposed the gap: ReferenceError: process is not
// defined, in the browser, the moment metaEnv's value was falsy.
const isNodeContext = typeof process !== 'undefined' && Boolean(process.env)
const nodeEnv = isNodeContext ? process.env : {}

export const env = {
  SUPABASE_URL: metaEnv.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: metaEnv.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY || '',
  GEMINI_API_KEY: metaEnv.VITE_GEMINI_API_KEY || nodeEnv.VITE_GEMINI_API_KEY || '',
  // Optional comma-separated model override/order for the OCR model pool (see
  // src/config/geminiModels.config.js). Empty/unset falls back to the built-in default pool.
  GEMINI_OCR_MODELS: metaEnv.VITE_GEMINI_OCR_MODELS || nodeEnv.VITE_GEMINI_OCR_MODELS || '',
}

/**
 * Validates mandatory environment variables.
 * @returns {boolean} True if all mandatory environment variables are present.
 */
export function validateEnv() {
  const missing = []
  if (!env.SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!env.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')

  if (missing.length > 0) {
    console.warn(`[Config] Missing environment variables: ${missing.join(', ')}`)
    return false
  }
  return true
}
