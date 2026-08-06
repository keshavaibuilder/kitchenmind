/**
 * Centralized Environment Configuration
 * Validates and exposes environment variables required by KitchenMind.
 */

export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',
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
