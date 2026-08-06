import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env.config'

const supabaseUrl = env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables.')
}

/**
 * Centralized Supabase Client Singleton
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
