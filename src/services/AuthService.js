import { supabaseClient } from './supabaseClient'
import { normalizeError } from '@/utils/errors'

/**
 * AuthService
 * Framework-agnostic authentication service.
 * Standardized error handling and plain JS object returns.
 */
export const AuthService = {
  /**
   * Starts Google OAuth sign-in.
   * @returns {Promise<{ success: boolean }>}
   */
  async signInWithGoogle() {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) {
        throw normalizeError(error, 'AUTH_GOOGLE_SIGNIN_FAILED')
      }

      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'AUTH_GOOGLE_SIGNIN_FAILED')
    }
  },

  /**
   * Sends a magic link OTP to the user's email address.
   * Type: Simple CRUD / Auth API Call
   * @param {Object} params
   * @param {string} params.email
   * @param {string} [params.redirectTo]
   * @returns {Promise<{ success: boolean }>}
   */
  async signInWithOtp({ email, redirectTo }) {
    try {
      const redirectUrl = redirectTo || `${window.location.origin}/auth/callback`
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectUrl },
      })

      if (error) {
        throw normalizeError(error, 'AUTH_SIGNIN_FAILED')
      }

      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'AUTH_SIGNIN_FAILED')
    }
  },

  /**
   * Retrieves current active session.
   * Type: Simple CRUD / Local Session
   * @returns {Promise<{ session: Object|null, user: Object|null }>}
   */
  async getSession() {
    try {
      const { data, error } = await supabaseClient.auth.getSession()

      if (error) {
        throw normalizeError(error, 'AUTH_SESSION_FAILED')
      }

      const session = data?.session ?? null
      const user = session?.user ?? null

      return { session, user }
    } catch (err) {
      throw normalizeError(err, 'AUTH_SESSION_FAILED')
    }
  },

  /**
   * Retrieves current authenticated user object.
   * Type: Simple CRUD / Local Session
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    try {
      const { session } = await this.getSession()
      return session?.user ?? null
    } catch (err) {
      throw normalizeError(err, 'AUTH_USER_FAILED')
    }
  },

  /**
   * Signs out current authenticated user.
   * Type: Simple CRUD / Auth API Call
   * @returns {Promise<{ success: boolean }>}
   */
  async signOut() {
    try {
      const { error } = await supabaseClient.auth.signOut()

      if (error) {
        throw normalizeError(error, 'AUTH_SIGNOUT_FAILED')
      }

      return { success: true }
    } catch (err) {
      throw normalizeError(err, 'AUTH_SIGNOUT_FAILED')
    }
  },

  /**
   * Subscribes to authentication state changes.
   * Type: Event Listener
   * @param {function(string, Object|null): void} callback 
   * @returns {{ unsubscribe: function(): void }}
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session ? { session, user: session.user ?? null } : null)
      }
    )

    return {
      unsubscribe: () => subscription.unsubscribe(),
    }
  },
}
