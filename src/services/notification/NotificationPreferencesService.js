/**
 * KitchenMind Notification Preferences Service (Sprint 7C)
 * Manages household notification delivery settings, quiet hours, daily limits, and severity filters.
 */

const STORAGE_KEY_PREFIX = 'km_notif_prefs_'

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  notificationsEnabled: true,
  quietHours: {
    enabled: true,
    startHour: 22, // 10:00 PM
    endHour: 7,    // 07:00 AM
  },
  maxNotificationsPerDay: 3,
  minSeverity: 'warning', // 'critical' | 'warning' | 'info'
  categoriesEnabled: {
    INVENTORY: true,
    MEALS: true,
    SHOPPING: true,
    HOUSEHOLD: true,
  },
  digestEnabled: true,
  digestWindow: 'morning', // 'morning' (8:00 AM) | 'evening' (6:00 PM)
  allowCriticalBypassQuietHours: false, // Strict quiet hours by default
}

export const NotificationPreferencesService = {
  /**
   * Retrieves notification preferences for a household.
   * @param {string} householdId
   * @returns {Object} Preferences object
   */
  getPreferences(householdId) {
    if (!householdId) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${householdId}`)
      if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...parsed,
        quietHours: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
          ...(parsed.quietHours || {}),
        },
        categoriesEnabled: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.categoriesEnabled,
          ...(parsed.categoriesEnabled || {}),
        },
      }
    } catch {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    }
  },

  /**
   * Updates notification preferences for a household.
   * @param {string} householdId
   * @param {Object} updates
   * @returns {Object} Updated preferences object
   */
  updatePreferences(householdId, updates = {}) {
    if (!householdId) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    try {
      const current = this.getPreferences(householdId)
      const updated = {
        ...current,
        ...updates,
        quietHours: {
          ...current.quietHours,
          ...(updates.quietHours || {}),
        },
        categoriesEnabled: {
          ...current.categoriesEnabled,
          ...(updates.categoriesEnabled || {}),
        },
      }
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${householdId}`, JSON.stringify(updated))
      return updated
    } catch (err) {
      console.warn('[NotificationPreferencesService] Failed to save preferences:', err)
      return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    }
  },

  /**
   * Resets notification preferences for a household to defaults.
   * @param {string} householdId
   */
  resetPreferences(householdId) {
    if (!householdId) return
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${householdId}`)
    } catch (err) {
      console.warn('[NotificationPreferencesService] Failed to reset preferences:', err)
    }
  },
}
