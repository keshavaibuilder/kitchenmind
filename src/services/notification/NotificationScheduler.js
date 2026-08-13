import { NotificationService } from './NotificationService.js'
import { NotificationPolicyService, DELIVERY_MODES } from './NotificationPolicyService.js'

export const NotificationScheduler = {
  /**
   * Processes active insights for a household and schedules/delivers notifications according to policy.
   * Performs pre-delivery re-validation (checks freshness, quiet hours, resolution, deduplication).
   *
   * @param {string} householdId
   * @param {Array<Object>} activeInsights Array of validated active Insight objects
   * @param {Object} [options]
   * @param {Date} [options.nowDate] Custom execution timestamp
   * @returns {{ processed: number, delivered: number, scheduled: number, suppressed: number }}
   */
  processInsights(householdId, activeInsights = [], options = {}) {
    if (!householdId || !Array.isArray(activeInsights)) {
      return { processed: 0, delivered: 0, scheduled: 0, suppressed: 0 }
    }

    const nowDate = options.nowDate || new Date()
    const existing = NotificationService.getNotifications(householdId)
    const todayStr = nowDate.toISOString().slice(0, 10)

    let delivered = 0
    let scheduled = 0
    let suppressed = 0

    const sentTodayCount = existing.filter(
      (n) => n.created_at?.slice(0, 10) === todayStr && n.status !== 'DISMISSED'
    ).length

    for (const insight of activeInsights) {
      // Pre-delivery Re-validation: Check expiration
      if (insight.expires_at && new Date(insight.expires_at) < nowDate) {
        suppressed++
        continue
      }

      // Pre-delivery Re-validation: Evaluate Policy
      const policy = NotificationPolicyService.evaluate(insight, householdId, {
        sentTodayCount: sentTodayCount + delivered,
        nowDate,
      })

      if (!policy.eligible || policy.mode === DELIVERY_MODES.SUPPRESSED) {
        suppressed++
        continue
      }

      const notif = NotificationService.createNotificationFromInsight(insight, householdId, policy)
      if (notif) {
        if (policy.mode === DELIVERY_MODES.IMMEDIATE) {
          delivered++
        } else {
          scheduled++
        }
      } else {
        suppressed++
      }
    }

    return {
      processed: activeInsights.length,
      delivered,
      scheduled,
      suppressed,
    }
  },
}
