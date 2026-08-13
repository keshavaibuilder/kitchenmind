import { describe, it, expect, beforeEach } from 'vitest'
import { InsightStateService } from '../InsightStateService.js'

describe('InsightStateService', () => {
  const householdId = 'hh-state-test'

  beforeEach(() => {
    localStorage.clear()
  })

  it('persists and retrieves dismissed deduplication keys for a household', () => {
    expect(InsightStateService.getDismissedKeys(householdId).size).toBe(0)

    InsightStateService.dismissInsight(householdId, 'KEY_1')
    InsightStateService.dismissInsight(householdId, 'KEY_2')

    const dismissed = InsightStateService.getDismissedKeys(householdId)
    expect(dismissed.has('KEY_1')).toBe(true)
    expect(dismissed.has('KEY_2')).toBe(true)
  })

  it('filters active insights against dismissals and expiration', () => {
    InsightStateService.dismissInsight(householdId, 'DISMISSED_KEY')

    const now = new Date()
    const futureDate = new Date(now.getTime() + 86_400_000).toISOString()
    const pastDate = new Date(now.getTime() - 86_400_000).toISOString()

    const rawInsights = [
      {
        insight_id: 'i1',
        severity: 'info',
        confidence: { score: 0.7 },
        deduplication_key: 'ACTIVE_KEY',
        expires_at: futureDate,
      },
      {
        insight_id: 'i2',
        severity: 'critical',
        confidence: { score: 0.9 },
        deduplication_key: 'DISMISSED_KEY',
        expires_at: futureDate,
      },
      {
        insight_id: 'i3',
        severity: 'warning',
        confidence: { score: 0.8 },
        deduplication_key: 'EXPIRED_KEY',
        expires_at: pastDate,
      },
    ]

    const filtered = InsightStateService.filterActiveInsights(rawInsights, householdId)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].insight_id).toBe('i1')
  })

  it('sorts insights by severity (critical > warning > info) and then confidence score', () => {
    const rawInsights = [
      { insight_id: 'i-info', severity: 'info', confidence: { score: 0.95 }, deduplication_key: 'K1' },
      { insight_id: 'i-crit', severity: 'critical', confidence: { score: 0.70 }, deduplication_key: 'K2' },
      { insight_id: 'i-warn', severity: 'warning', confidence: { score: 0.85 }, deduplication_key: 'K3' },
    ]

    const filtered = InsightStateService.filterActiveInsights(rawInsights, householdId)
    expect(filtered[0].insight_id).toBe('i-crit')
    expect(filtered[1].insight_id).toBe('i-warn')
    expect(filtered[2].insight_id).toBe('i-info')
  })
})
