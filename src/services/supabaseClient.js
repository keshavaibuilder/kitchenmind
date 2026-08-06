import { createClient } from '@supabase/supabase-js'
import { env, isViteContext } from '../config/env.config.js'

const supabaseUrl = env.SUPABASE_URL
const supabaseAnonKey = env.SUPABASE_ANON_KEY

// Fail fast in real browser/build contexts so a misconfigured deploy errors loudly at startup
// instead of surfacing as an opaque network failure on the first Supabase call. Node-only
// contexts (test/benchmark scripts run outside Vite) fall back to a placeholder client, since
// those scripts mock the network layer entirely and never hit a real host.
if (isViteContext && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables.')
}

/**
 * Centralized Supabase Client Singleton
 */
export const supabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder_anon_key'
)
