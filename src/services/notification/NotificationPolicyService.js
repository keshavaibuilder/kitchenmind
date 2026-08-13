import { NotificationPreferencesService } from './NotificationPreferencesService.js'
import { InsightStateService } from '../insight/InsightStateService.js'

export const DELIVERY_MODES = {
  IMMEDIATE: 'IMMEDIATE',
  SCHEDULED: 'SCHEDULED',
  DIGEST: 'DIGEST',
  SUPPRESSED: 'SUPPRESSED',
}

export const SEVERITY_RANK = {
  critical: 3,
  warning: 2,
  info: 1,
}

export const NotificationPolicyService = {
  /**
   * Checks if current local hour falls within configured quiet hours window.
   * @param {Object} quietHours { enabled, startHour, endHour }
   * @param {Date} [nowDate]
   * @returns {boolean}
   */
  isQuietHours(quietHours = {}, nowDate = new Date()) {
    if (!quietHours.enabled) return false
    const currentHour = nowDate.getHours()
    const start = quietHours.startHour ?? 22
    const end = quietHours.endHour ?? 7

    if (start > end) {
      // Overnight quiet hours (e.g. 22:00 to 07:00)
      return currentHour >= start || currentHour < end
    }
    // Daytime quiet hours window (e.g. 13:00 to 15:00)
    return currentHour >= start && currentHour < end
  },

  /**
   * Evaluates a validated insight against household preferences and policy rules.
   *
   * @param {Object} insight Validated InsightObject
   * @param {string} householdId
   * @param {Object} [options]
   * @param {number} [options.sentTodayCount] Count of notifications delivered today
   * @param {Date} [options.nowDate] Custom evaluation timestamp
   * @returns {{ mode: string, reason: string, eligible: boolean }}
   */
  evaluate(insight, householdId, options = {}) {
    if (!insight || !householdId) {
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'INVALID_INPUT', eligible: false }
    }

    const prefs = NotificationPreferencesService.getPreferences(householdId)
    const nowDate = options.nowDate || new Date()
    const sentTodayCount = options.sentTodayCount || 0

    // 1. Global Opt-In
    if (!prefs.notificationsEnabled) {
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'USER_DISABLED', eligible: false }
    }

    // 2. Freshness & Expiration Check
    if (insight.expires_at && new Date(insight.expires_at) < nowDate) {
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'INSIGHT_EXPIRED', eligible: false }
    }

    // 3. Dismissal / Resolution Pre-Delivery Check
    const dismissedKeys = InsightStateService.getDismissedKeys(householdId)
    if (dismissedKeys.has(insight.deduplication_key)) {
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'INSIGHT_DISMISSED', eligible: false }
    }

    // 4. Minimum Severity Check
    const insightRank = SEVERITY_RANK[insight.severity] || 1
    const minRank = SEVERITY_RANK[prefs.minSeverity] || 2
    if (insightRank < minRank) {
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'BELOW_MIN_SEVERITY', eligible: false }
    }

    // 5. Daily Volume Limit
    if (sentTodayCount >= prefs.maxNotificationsPerDay) {
      if (prefs.digestEnabled && insightRank >= 2) {
        return { mode: DELIVERY_MODES.DIGEST, reason: 'DAILY_LIMIT_DIGEST', eligible: true }
      }
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'DAILY_LIMIT_REACHED', eligible: false }
    }

    // 6. Quiet Hours Evaluation
    const inQuietHours = this.isQuietHours(prefs.quietHours, nowDate)
    if (inQuietHours) {
      if (insight.severity === 'critical' && prefs.allowCriticalBypassQuietHours) {
        return { mode: DELIVERY_MODES.IMMEDIATE, reason: 'CRITICAL_BYPASS_QUIET_HOURS', eligible: true }
      }
      if (prefs.digestEnabled) {
        return { mode: DELIVERY_MODES.SCHEDULED, reason: 'DEFERRED_QUIET_HOURS', eligible: true }
      }
      return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'QUIET_HOURS_ACTIVE', eligible: false }
    }

    // 7. Priority Matrix Evaluation
    if (insight.severity === 'critical' && insight.confidence?.score >= 0.80) {
      return { mode: DELIVERY_MODES.IMMEDIATE, reason: 'CRITICAL_HIGH_CONFIDENCE', eligible: true }
    }

    if (insight.severity === 'warning' && insight.confidence?.score >= 0.65) {
      return { mode: DELIVERY_MODES.SCHEDULED, reason: 'WARNING_SCHEDULED', eligible: true }
    }

    if (prefs.digestEnabled) {
      return { mode: DELIVERY_MODES.DIGEST, reason: 'DIGEST_ELIGIBLE', eligible: true }
    }

    return { mode: DELIVERY_MODES.SUPPRESSED, reason: 'DEFAULT_SUPPRESSION', eligible: false }
  },
}
