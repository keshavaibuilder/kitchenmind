/**
 * KitchenMind Insight State Service (Sprint 7A)
 * Manages client-side lifecycle states (NEW, ACTIVE, ACKNOWLEDGED, DISMISSED, EXPIRED, RESOLVED)
 * and deduplication persistence in localStorage keyed by household_id.
 */

const STORAGE_KEY_PREFIX = 'km_insights_dismissed_'

export const InsightStateService = {
  /**
   * Gets the set of dismissed insight deduplication keys for a household.
   * @param {string} householdId
   * @returns {Set<string>}
   */
  getDismissedKeys(householdId) {
    if (!householdId) return new Set()
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${householdId}`)
      if (!raw) return new Set()
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  },

  /**
   * Marks an insight deduplication key as dismissed.
   * @param {string} householdId
   * @param {string} deduplicationKey
   */
  dismissInsight(householdId, deduplicationKey) {
    if (!householdId || !deduplicationKey) return
    try {
      const dismissed = this.getDismissedKeys(householdId)
      dismissed.add(deduplicationKey)
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${householdId}`, JSON.stringify(Array.from(dismissed)))
    } catch (err) {
      console.warn('[InsightStateService] Failed to persist dismissal:', err)
    }
  },

  /**
   * Resets all dismissed insights for a household.
   * @param {string} householdId
   */
  clearDismissals(householdId) {
    if (!householdId) return
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${householdId}`)
    } catch (err) {
      console.warn('[InsightStateService] Failed to clear dismissals:', err)
    }
  },

  /**
   * Filters and applies lifecycle state to generated insights.
   * Removes dismissed or expired insights.
   *
   * @param {Array<Object>} insights
   * @param {string} householdId
   * @returns {Array<Object>} Active, non-dismissed, non-expired insights sorted by severity & confidence
   */
  filterActiveInsights(insights = [], householdId) {
    if (!Array.isArray(insights)) return []
    const dismissedKeys = this.getDismissedKeys(householdId)
    const now = new Date()

    return insights
      .filter((ins) => {
        // Exclude dismissed
        if (dismissedKeys.has(ins.deduplication_key)) return false
        // Exclude expired
        if (ins.expires_at && new Date(ins.expires_at) < now) return false
        return true
      })
      .sort((a, b) => {
        // Priority sort: critical > warning > info, then higher confidence score
        const severityOrder = { critical: 3, warning: 2, info: 1 }
        const sevDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
        if (sevDiff !== 0) return sevDiff
        return (b.confidence?.score || 0) - (a.confidence?.score || 0)
      })
  },
}
