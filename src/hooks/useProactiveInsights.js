import { useState, useMemo, useCallback } from 'react'
import { InsightEngine } from '../services/insight/InsightEngine.js'
import { InsightStateService } from '../services/insight/InsightStateService.js'

/**
 * React Hook for Proactive Kitchen Intelligence Insights (Sprint 7A)
 * Generates and manages deterministic insights derived from pre-fetched dashboard state.
 */
export function useProactiveInsights({
  householdId,
  pantryItems = [],
  predictions = [],
  expiringBatches = [],
  mealLogs = [],
  recipes = [],
  observations = [],
  preferences = {},
  memories = [],
} = {}) {
  const [dismissedKeys, setDismissedKeys] = useState(() => InsightStateService.getDismissedKeys(householdId))

  // Generate deterministic insights from pre-fetched context
  const rawInsights = useMemo(() => {
    if (!householdId) return []
    return InsightEngine.generateInsights({
      householdId,
      pantryItems,
      predictions,
      expiringBatches,
      mealLogs,
      recipes,
      observations,
      preferences,
      memories,
    })
  }, [householdId, pantryItems, predictions, expiringBatches, mealLogs, recipes, observations, preferences, memories])

  // Filter active insights against dismissals and expiration
  const activeInsights = useMemo(() => {
    if (!householdId) return []
    const now = new Date()
    return rawInsights
      .filter((ins) => {
        if (dismissedKeys.has(ins.deduplication_key)) return false
        if (ins.expires_at && new Date(ins.expires_at) < now) return false
        return true
      })
      .sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 }
        const sevDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
        if (sevDiff !== 0) return sevDiff
        return (b.confidence?.score || 0) - (a.confidence?.score || 0)
      })
  }, [rawInsights, dismissedKeys, householdId])

  // Handle user dismissal of an insight
  const dismissInsight = useCallback(
    (deduplicationKey) => {
      InsightStateService.dismissInsight(householdId, deduplicationKey)
      setDismissedKeys(new Set(InsightStateService.getDismissedKeys(householdId)))
    },
    [householdId]
  )

  // Reset all dismissals
  const resetDismissals = useCallback(() => {
    InsightStateService.clearDismissals(householdId)
    setDismissedKeys(new Set())
  }, [householdId])

  return {
    insights: activeInsights,
    totalGenerated: rawInsights.length,
    activeCount: activeInsights.length,
    criticalCount: activeInsights.filter((i) => i.severity === 'critical').length,
    warningCount: activeInsights.filter((i) => i.severity === 'warning').length,
    infoCount: activeInsights.filter((i) => i.severity === 'info').length,
    dismissInsight,
    resetDismissals,
  }
}
