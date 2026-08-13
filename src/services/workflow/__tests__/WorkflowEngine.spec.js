import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowEngine } from '../WorkflowEngine.js'
import { WORKFLOW_STATUS } from '../workflowRegistry.js'

describe('WorkflowEngine', () => {
  const householdId = 'hh-wf-engine-test'

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no insights or householdId provided', () => {
    expect(WorkflowEngine.evaluateWorkflows({})).toEqual([])
  })

  it('maps WORKFLOW-01 (Depletion Shopping) from LIKELY_DEPLETION insight', () => {
    const activeInsights = [
      {
        insight_id: 'ins-dep-rice',
        insight_type: 'LIKELY_DEPLETION',
        title: 'Basmati Rice low',
        summary: 'Basmati Rice depletes in 2 days',
        severity: 'critical',
        confidence: { score: 0.88 },
        evidence: [{ type: 'PREDICTED_DEPLETION_DAYS', value: 2 }],
        related_entities: { canonicalName: 'Basmati Rice' },
      },
    ]

    const res = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights })
    expect(res.length).toBe(1)
    const wf = res[0]
    expect(wf.workflow_id).toBe('WF-01-DEPLETION-SHOPPING')
    expect(wf.status).toBe(WORKFLOW_STATUS.ELIGIBLE)
    expect(wf.originating_insight.insight_id).toBe('ins-dep-rice')
    expect(wf.requires_confirmation).toBe(true)
  })

  it('suppresses workflows below minimum confidence threshold', () => {
    const lowConfInsights = [
      {
        insight_id: 'ins-low-conf',
        insight_type: 'USE_SOON',
        title: 'Expiring Milk',
        confidence: { score: 0.40 }, // Below 0.70 threshold for WF-02
        related_entities: { canonicalName: 'Milk' },
      },
    ]

    const res = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights: lowConfInsights })
    expect(res.length).toBe(0)
  })

  it('respects cooldowns and prevents duplicate workflow generation', () => {
    const activeInsights = [
      {
        insight_id: 'ins-dep-oil',
        insight_type: 'LIKELY_DEPLETION',
        title: 'Olive Oil low',
        confidence: { score: 0.85 },
        related_entities: { canonicalName: 'Olive Oil' },
      },
    ]

    const now = new Date()
    const res1 = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights, nowDate: now })
    expect(res1.length).toBe(1)

    // Simulate saving instance to trigger cooldown
    localStorage.setItem(
      `km_workflows_${householdId}`,
      JSON.stringify([
        {
          workflow_id: 'WF-01-DEPLETION-SHOPPING',
          created_at: now.toISOString(),
          related_entities: { canonicalName: 'Olive Oil' },
        },
      ])
    )

    const res2 = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights, nowDate: now })
    expect(res2.length).toBe(0) // Suppressed by cooldown
  })
})
