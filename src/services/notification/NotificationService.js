import { NotificationPolicyService, DELIVERY_MODES } from './NotificationPolicyService.js'

const NOTIFICATION_STORAGE_PREFIX = 'km_notifs_'

export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  DISMISSED: 'DISMISSED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
}

export const NotificationService = {
  /**
   * Loads all non-dismissed notifications for a household.
   * @param {string} householdId
   * @returns {Array<Object>}
   */
  getNotifications(householdId) {
    if (!householdId) return []
    try {
      const raw = localStorage.getItem(`${NOTIFICATION_STORAGE_PREFIX}${householdId}`)
      if (!raw) return []
      const arr = JSON.parse(raw)
      const now = new Date()
      return (Array.isArray(arr) ? arr : [])
        .filter((n) => n.status !== NOTIFICATION_STATUS.DISMISSED)
        .filter((n) => !n.expires_at || new Date(n.expires_at) > now)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } catch {
      return []
    }
  },

  /**
   * Returns count of unread notifications for a household.
   * @param {string} householdId
   * @returns {number}
   */
  getUnreadCount(householdId) {
    const list = this.getNotifications(householdId)
    return list.filter((n) => n.status === NOTIFICATION_STATUS.DELIVERED || n.status === NOTIFICATION_STATUS.SENT).length
  },

  /**
   * Marks a notification as read.
   * @param {string} householdId
   * @param {string} notificationId
   */
  markAsRead(householdId, notificationId) {
    if (!householdId || !notificationId) return
    const list = this.getNotifications(householdId)
    const updated = list.map((n) => {
      if (n.id === notificationId) {
        return { ...n, status: NOTIFICATION_STATUS.READ, read_at: new Date().toISOString() }
      }
      return n
    })
    this._save(householdId, updated)
  },

  /**
   * Marks all notifications as read for a household.
   * @param {string} householdId
   */
  markAllAsRead(householdId) {
    if (!householdId) return
    const list = this.getNotifications(householdId)
    const nowIso = new Date().toISOString()
    const updated = list.map((n) => ({ ...n, status: NOTIFICATION_STATUS.READ, read_at: nowIso }))
    this._save(householdId, updated)
  },

  /**
   * Dismisses a notification.
   * @param {string} householdId
   * @param {string} notificationId
   */
  dismissNotification(householdId, notificationId) {
    if (!householdId || !notificationId) return
    const list = this.getNotifications(householdId)
    const updated = list.map((n) => {
      if (n.id === notificationId) {
        return { ...n, status: NOTIFICATION_STATUS.DISMISSED }
      }
      return n
    })
    this._save(householdId, updated)
  },

  /**
   * Clears all notifications for a household.
   * @param {string} householdId
   */
  clearAllNotifications(householdId) {
    if (!householdId) return
    try {
      localStorage.removeItem(`${NOTIFICATION_STORAGE_PREFIX}${householdId}`)
    } catch (err) {
      console.warn('[NotificationService] Failed to clear notifications:', err)
    }
  },

  /**
   * Idempotently creates and stores a notification from a validated Insight object.
   *
   * @param {Object} insight Validated InsightObject
   * @param {string} householdId
   * @param {Object} [customPolicy] Pre-computed policy result
   * @returns {Object|null} Created notification object or null if suppressed/duplicate
   */
  createNotificationFromInsight(insight, householdId, customPolicy = null) {
    if (!insight || !householdId) return null

    const existing = this.getNotifications(householdId)
    const todayStr = new Date().toISOString().slice(0, 10)
    const idempotencyKey = `NOTIF:${insight.deduplication_key}:${todayStr}`

    // Idempotency check: avoid double-delivering same insight on same day
    const duplicate = existing.find((n) => n.idempotency_key === idempotencyKey)
    if (duplicate) {
      return null
    }

    // Count sent today for volume limit
    const sentTodayCount = existing.filter(
      (n) => n.created_at?.slice(0, 10) === todayStr && n.status !== NOTIFICATION_STATUS.DISMISSED
    ).length

    const policy = customPolicy || NotificationPolicyService.evaluate(insight, householdId, { sentTodayCount })
    if (!policy.eligible || policy.mode === DELIVERY_MODES.SUPPRESSED) {
      return null
    }

    const nowIso = new Date().toISOString()
    const notification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      household_id: householdId,
      insight_id: insight.insight_id,
      insight_type: insight.insight_type,
      title: insight.title,
      summary: insight.summary,
      severity: insight.severity,
      delivery_mode: policy.mode,
      status: policy.mode === DELIVERY_MODES.IMMEDIATE ? NOTIFICATION_STATUS.DELIVERED : NOTIFICATION_STATUS.SCHEDULED,
      idempotency_key: idempotencyKey,
      evidence: insight.evidence || [],
      suggested_next_step: insight.suggested_next_step || null,
      created_at: nowIso,
      scheduled_at: nowIso,
      delivered_at: policy.mode === DELIVERY_MODES.IMMEDIATE ? nowIso : null,
      read_at: null,
      expires_at: insight.expires_at || null,
    }

    this._save(householdId, [notification, ...existing])
    return notification
  },

  /**
   * Private persistence helper.
   */
  _save(householdId, notifications) {
    try {
      localStorage.setItem(`${NOTIFICATION_STORAGE_PREFIX}${householdId}`, JSON.stringify(notifications))
    } catch (err) {
      console.warn('[NotificationService] Failed to save notifications:', err)
    }
  },
}
