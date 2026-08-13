import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationPolicyService, DELIVERY_MODES } from '../NotificationPolicyService.js'
import { NotificationPreferencesService } from '../NotificationPreferencesService.js'

describe('NotificationPolicyService', () => {
  const householdId = 'hh-policy-test'

  beforeEach(() => {
    localStorage.clear()
    NotificationPreferencesService.resetPreferences(householdId)
  })

  it('correctly calculates overnight quiet hours window (22:00 to 07:00)', () => {
    const quietHours = { enabled: true, startHour: 22, endHour: 7 }
    const nightTime = new Date('2026-08-12T23:30:00Z')
    nightTime.setHours(23)
    expect(NotificationPolicyService.isQuietHours(quietHours, nightTime)).toBe(true)

    const dayTime = new Date('2026-08-12T14:00:00Z')
    dayTime.setHours(14)
    expect(NotificationPolicyService.isQuietHours(quietHours, dayTime)).toBe(false)
  })

  it('suppresses notification when user disabled notifications globally', () => {
    NotificationPreferencesService.updatePreferences(householdId, { notificationsEnabled: false })
    const insight = {
      insight_type: 'LIKELY_DEPLETION',
      severity: 'critical',
      confidence: { score: 0.90 },
      deduplication_key: 'LIKELY_DEPLETION:rice',
    }

    const res = NotificationPolicyService.evaluate(insight, householdId)
    expect(res.mode).toBe(DELIVERY_MODES.SUPPRESSED)
    expect(res.reason).toBe('USER_DISABLED')
  })

  it('evaluates CRITICAL + HIGH confidence insight for IMMEDIATE delivery outside quiet hours', () => {
    const dayTime = new Date()
    dayTime.setHours(14) // 2 PM

    const insight = {
      insight_type: 'LIKELY_DEPLETION',
      severity: 'critical',
      confidence: { score: 0.90 },
      deduplication_key: 'LIKELY_DEPLETION:rice',
    }

    const res = NotificationPolicyService.evaluate(insight, householdId, { nowDate: dayTime })
    expect(res.mode).toBe(DELIVERY_MODES.IMMEDIATE)
    expect(res.eligible).toBe(true)
  })

  it('defers notification during quiet hours', () => {
    const nightTime = new Date()
    nightTime.setHours(23) // 11 PM

    const insight = {
      insight_type: 'DINNER_NOT_PLANNED',
      severity: 'warning',
      confidence: { score: 0.85 },
      deduplication_key: 'DINNER_UNPLANNED:2026-08-12',
    }

    const res = NotificationPolicyService.evaluate(insight, householdId, { nowDate: nightTime })
    expect(res.mode).toBe(DELIVERY_MODES.SCHEDULED)
    expect(res.reason).toBe('DEFERRED_QUIET_HOURS')
  })

  it('suppresses notification when daily limit is reached', () => {
    const dayTime = new Date()
    dayTime.setHours(14)

    NotificationPreferencesService.updatePreferences(householdId, {
      maxNotificationsPerDay: 2,
      digestEnabled: false,
    })

    const insight = {
      insight_type: 'LOW_STOCK',
      severity: 'warning',
      confidence: { score: 0.80 },
      deduplication_key: 'LOW_STOCK:oil',
    }

    const res = NotificationPolicyService.evaluate(insight, householdId, {
      sentTodayCount: 2,
      nowDate: dayTime,
    })

    expect(res.mode).toBe(DELIVERY_MODES.SUPPRESSED)
    expect(res.reason).toBe('DAILY_LIMIT_REACHED')
  })

  it('suppresses expired insights', () => {
    const expiredInsight = {
      insight_type: 'USE_SOON',
      severity: 'critical',
      confidence: { score: 0.90 },
      expires_at: '2026-08-01T00:00:00Z',
      deduplication_key: 'USE_SOON:batch-1',
    }

    const res = NotificationPolicyService.evaluate(expiredInsight, householdId)
    expect(res.mode).toBe(DELIVERY_MODES.SUPPRESSED)
    expect(res.reason).toBe('INSIGHT_EXPIRED')
  })
})
