import { useState, useEffect, useCallback } from 'react'
import { WorkflowEngine } from '../services/workflow/WorkflowEngine.js'
import { WorkflowStateService } from '../services/workflow/WorkflowStateService.js'

/**
 * React Hook for Proactive Workflows (Sprint 7D)
 * Evaluates active insights and manages workflow state & user interactions.
 */
export function useWorkflows({ householdId, activeInsights = [] } = {}) {
  const [workflows, setWorkflows] = useState([])

  const refreshWorkflows = useCallback(() => {
    if (!householdId) return
    const evaluated = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights })
    const dismissed = WorkflowStateService.getWorkflows(householdId)
    const dismissedIds = new Set(dismissed.filter((w) => w.status === 'DISMISSED').map((w) => w.workflow_instance_id))

    const active = evaluated.filter((w) => !dismissedIds.has(w.workflow_instance_id))
    setWorkflows(active)
  }, [householdId, activeInsights])

  useEffect(() => {
    refreshWorkflows()
  }, [refreshWorkflows])

  const dismissWorkflow = useCallback(
    (workflowInstanceId) => {
      WorkflowStateService.dismissWorkflow(householdId, workflowInstanceId)
      refreshWorkflows()
    },
    [householdId, refreshWorkflows]
  )

  const completeWorkflow = useCallback(
    (workflowInstanceId) => {
      WorkflowStateService.completeWorkflow(householdId, workflowInstanceId)
      refreshWorkflows()
    },
    [householdId, refreshWorkflows]
  )

  return {
    workflows,
    dismissWorkflow,
    completeWorkflow,
    refreshWorkflows,
  }
}
