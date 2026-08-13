import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationScheduler } from '../NotificationScheduler.js'
import { NotificationService } from '../NotificationService.js'
import { NotificationPreferencesService } from '../NotificationPreferencesService.js'

describe('NotificationScheduler', () => {
  const householdId = 'hh-scheduler-test'

  beforeEach(() => {
    localStorage.clear()
    NotificationPreferencesService.resetPreferences(householdId)
  })

  it('processes insights and respects idempotency across retries', () => {
    const activeInsights = [
      {
        insight_id: 'ins-sch-1',
        insight_type: 'LIKELY_DEPLETION',
        title: 'Basmati Rice low',
        summary: 'Depleting in 2 days',
        severity: 'critical',
        confidence: { score: 0.90 },
        deduplication_key: 'LIKELY_DEPLETION:rice',
      },
    ]

    const dayTime = new Date()
    dayTime.setHours(14)

    const res1 = NotificationScheduler.processInsights(householdId, activeInsights, { nowDate: dayTime })
    expect(res1.delivered).toBe(1)

    // Immediate retry on same day suppresses duplicate
    const res2 = NotificationScheduler.processInsights(householdId, activeInsights, { nowDate: dayTime })
    expect(res2.delivered).toBe(0)
    expect(res2.suppressed).toBe(1)
  })

  it('suppresses expired insights pre-delivery', () => {
    const expiredInsights = [
      {
        insight_id: 'ins-sch-2',
        insight_type: 'USE_SOON',
        title: 'Expired Milk',
        severity: 'critical',
        confidence: { score: 0.90 },
        expires_at: '2026-08-01T00:00:00Z',
        deduplication_key: 'USE_SOON:milk',
      },
    ]

    const res = NotificationScheduler.processInsights(householdId, expiredInsights)
    expect(res.delivered).toBe(0)
    expect(res.suppressed).toBe(1)
  })
})
