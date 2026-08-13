import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowStateService } from '../WorkflowStateService.js'

describe('WorkflowStateService', () => {
  const householdId = 'hh-wf-state-test'

  beforeEach(() => {
    localStorage.clear()
  })

  it('manages workflow dismissal and cooldown active state', () => {
    const instanceId = 'WF:WF-01-DEPLETION-SHOPPING:hh-wf-state-test:ins-1'
    const now = new Date()

    WorkflowStateService._save(householdId, [
      {
        workflow_instance_id: instanceId,
        workflow_id: 'WF-01-DEPLETION-SHOPPING',
        household_id: householdId,
        status: 'ELIGIBLE',
        created_at: now.toISOString(),
        related_entities: { canonicalName: 'basmati rice' },
      },
    ])

    expect(
      WorkflowStateService.isCooldownActive(householdId, 'WF-01-DEPLETION-SHOPPING', 'basmati rice', 24, now)
    ).toBe(true)

    WorkflowStateService.dismissWorkflow(householdId, instanceId)
    const list = WorkflowStateService.getWorkflows(householdId)
    expect(list.length).toBe(0) // Dismissed workflows filtered from active list
  })
})
