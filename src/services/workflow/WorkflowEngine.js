import { WORKFLOW_DEFINITIONS, WORKFLOW_STATUS } from './workflowRegistry.js'
import { WorkflowStateService } from './WorkflowStateService.js'

export const WorkflowEngine = {
  /**
   * Deterministically evaluates validated active insights against the controlled workflow registry.
   *
   * @param {Object} context
   * @param {string} context.householdId
   * @param {Array<Object>} [context.activeInsights] Validated active Insight objects from InsightEngine
   * @param {Date} [context.nowDate] Custom evaluation timestamp
   * @returns {Array<Object>} Array of deterministic WorkflowInstance objects
   */
  evaluateWorkflows(context = {}) {
    const { householdId, activeInsights = [], nowDate = new Date() } = context

    if (!householdId || !Array.isArray(activeInsights) || activeInsights.length === 0) {
      return []
    }

    const workflows = []
    const nowIso = nowDate.toISOString()

    for (const insight of activeInsights) {
      // 1. Check if insight is expired
      if (insight.expires_at && new Date(insight.expires_at) < nowDate) {
        continue
      }

      // 2. Find matching workflow definitions
      const matchingDefs = Object.values(WORKFLOW_DEFINITIONS).filter(
        (def) => def.enabled && def.trigger_insight_types.includes(insight.insight_type)
      )

      for (const def of matchingDefs) {
        // 3. Confidence threshold check
        if (insight.confidence?.score < def.minimum_confidence) {
          continue
        }

        const canonicalName = insight.related_entities?.canonicalName || ''

        // 4. Cooldown check
        if (WorkflowStateService.isCooldownActive(householdId, def.workflow_id, canonicalName, def.cooldown_hours, nowDate)) {
          continue
        }

        // 5. Build deterministic workflow_instance_id
        const instanceId = `WF:${def.workflow_id}:${householdId}:${insight.insight_id}`
        const expiresAt = insight.expires_at || new Date(nowDate.getTime() + def.expiration_hours * 3600000).toISOString()

        // 6. Assemble WorkflowInstance object preserving context
        let title = def.name
        let summary = insight.summary
        if (def.titleTemplate) title = def.titleTemplate(canonicalName)
        if (def.summaryTemplate) {
          summary = def.summaryTemplate(canonicalName, insight.evidence?.find((e) => e.type === 'PREDICTED_DEPLETION_DAYS')?.value || 2)
        }

        workflows.push({
          workflow_instance_id: instanceId,
          workflow_id: def.workflow_id,
          household_id: householdId,
          name: def.name,
          title,
          summary,
          status: WORKFLOW_STATUS.ELIGIBLE,
          priority: def.priority,
          allowed_actions: def.allowed_actions,
          requires_confirmation: def.requires_confirmation,
          originating_insight: {
            insight_id: insight.insight_id,
            insight_type: insight.insight_type,
            title: insight.title,
            summary: insight.summary,
            severity: insight.severity,
            evidence: insight.evidence || [],
            confidence: insight.confidence || {},
            deduplication_key: insight.deduplication_key,
            related_entities: insight.related_entities || {},
          },
          suggested_next_step: insight.suggested_next_step || null,
          created_at: nowIso,
          expires_at: expiresAt,
          updated_at: nowIso,
        })
      }
    }

    return workflows.sort((a, b) => b.priority - a.priority)
  },
}
