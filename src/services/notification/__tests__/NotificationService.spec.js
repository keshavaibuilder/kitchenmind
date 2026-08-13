import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService, NOTIFICATION_STATUS } from '../NotificationService.js'
import { NotificationPreferencesService } from '../NotificationPreferencesService.js'

describe('NotificationService', () => {
  const householdId = 'hh-notif-service-test'

  beforeEach(() => {
    localStorage.clear()
    NotificationPreferencesService.resetPreferences(householdId)
  })

  it('creates a notification from an insight idempotently', () => {
    const insight = {
      insight_id: 'ins-test-1',
      insight_type: 'LIKELY_DEPLETION',
      title: 'Basmati Rice low',
      summary: 'Depleting in 2 days',
      severity: 'critical',
      confidence: { score: 0.90 },
      deduplication_key: 'LIKELY_DEPLETION:rice',
      evidence: [{ type: 'STOCK', details: '100g remaining' }],
    }

    const notif = NotificationService.createNotificationFromInsight(insight, householdId, {
      eligible: true,
      mode: 'IMMEDIATE',
    })
    expect(notif).not.toBeNull()
    expect(notif.title).toBe('Basmati Rice low')
    expect(notif.status).toBe(NOTIFICATION_STATUS.DELIVERED)

    // Attempting duplicate creation on same day returns null (idempotent)
    const duplicate = NotificationService.createNotificationFromInsight(insight, householdId)
    expect(duplicate).toBeNull()

    const list = NotificationService.getNotifications(householdId)
    expect(list.length).toBe(1)
  })

  it('handles read state and unread count', () => {
    const insight = {
      insight_id: 'ins-test-2',
      insight_type: 'DINNER_NOT_PLANNED',
      title: "Dinner not planned",
      summary: "Schedule dinner for today",
      severity: 'warning',
      confidence: { score: 0.85 },
      deduplication_key: 'DINNER_UNPLANNED:2026-08-12',
    }

    const notif = NotificationService.createNotificationFromInsight(insight, householdId, {
      eligible: true,
      mode: 'IMMEDIATE',
    })

    expect(NotificationService.getUnreadCount(householdId)).toBe(1)

    NotificationService.markAsRead(householdId, notif.id)
    expect(NotificationService.getUnreadCount(householdId)).toBe(0)
  })

  it('dismisses notifications correctly', () => {
    const insight = {
      insight_id: 'ins-test-3',
      insight_type: 'LOW_STOCK',
      title: 'Oil low',
      summary: '150g remaining',
      severity: 'warning',
      confidence: { score: 0.80 },
      deduplication_key: 'LOW_STOCK:oil',
    }

    const notif = NotificationService.createNotificationFromInsight(insight, householdId, {
      eligible: true,
      mode: 'IMMEDIATE',
    })

    NotificationService.dismissNotification(householdId, notif.id)
    const list = NotificationService.getNotifications(householdId)
    expect(list.length).toBe(0)
  })
})
