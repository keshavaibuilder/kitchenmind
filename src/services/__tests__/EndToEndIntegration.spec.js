import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InsightEngine } from '../insight/InsightEngine.js'
import { NotificationScheduler } from '../notification/NotificationScheduler.js'
import { NotificationService } from '../notification/NotificationService.js'
import { NotificationPreferencesService } from '../notification/NotificationPreferencesService.js'
import { WorkflowEngine } from '../workflow/WorkflowEngine.js'
import { WorkflowStateService } from '../workflow/WorkflowStateService.js'
import { ActionExecutionService } from '../ActionExecutionService.js'
import { MealLogService } from '../MealLogService.js'
import { InventoryService } from '../InventoryService.js'

vi.mock('../MealLogService.js', () => ({
  MealLogService: {
    markAsCooked: vi.fn().mockResolvedValue({ success: true, mealLogId: 'ml-1' }),
    cookRecipeNow: vi.fn().mockResolvedValue({ success: true, mealLogId: 'ml-2' }),
    createMealLog: vi.fn().mockResolvedValue({ id: 'ml-3', status: 'planned' }),
  },
}))

vi.mock('../InventoryService.js', () => ({
  InventoryService: {
    addOrUpdateItem: vi.fn().mockResolvedValue({ id: 'inv-1', canonical_name: 'Rice' }),
  },
}))

describe('Sprint 7E Golden End-to-End Integration Suite', () => {
  const householdId = 'hh-e2e-certification'

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    ActionExecutionService._resetTokens()
    NotificationPreferencesService.resetPreferences(householdId)
  })

  it('E2E-01 & E2E-04: In-Stock Recipe -> Insight -> Notification -> Workflow -> Action Proposal -> Confirmation -> State Recalculation', async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const recipes = [
      {
        id: 'rec-1',
        name: 'Paneer Butter Masala',
        base_servings: 2,
        ingredients: [
          { canonical_name: 'paneer', base_quantity_grams: 200 },
          { canonical_name: 'butter', base_quantity_grams: 50 },
        ],
      },
    ]
    const pantryItems = [
      { canonical_name: 'paneer', quantity_grams: 400 },
      { canonical_name: 'butter', quantity_grams: 100 },
    ]

    // 1. Intelligence Evaluation (InsightEngine)
    const insights = InsightEngine.generateInsights({
      householdId,
      recipes,
      pantryItems,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })
    expect(insights.length).toBeGreaterThan(0)
    const readyInsight = insights.find((i) => i.insight_type === 'INGREDIENTS_AVAILABLE_FOR_MEAL')
    expect(readyInsight).toBeDefined()

    // 2. Notification Policy & Scheduler Evaluation
    const dayTime = new Date()
    dayTime.setHours(14)
    const notifRes = NotificationScheduler.processInsights(householdId, insights, { nowDate: dayTime })
    expect(notifRes.delivered + notifRes.scheduled).toBeGreaterThan(0)

    // 3. Workflow Engine Evaluation
    const workflows = WorkflowEngine.evaluateWorkflows({ householdId, activeInsights: insights, nowDate: dayTime })
    expect(workflows.length).toBeGreaterThan(0)
    const wf = workflows.find((w) => w.workflow_id === 'WF-04-INGREDIENTS-AVAILABLE-COOK')
    expect(wf).toBeDefined()
    expect(wf.requires_confirmation).toBe(true)

    // 4. Action Proposal & Out-of-Band Confirmation (ActionExecutionService)
    const actionProposal = wf.suggested_next_step.actionProposal
    expect(actionProposal).toBeDefined()

    const executionResult = await ActionExecutionService.executeAction({
      householdId,
      actionProposal,
    })
    expect(executionResult.success).toBe(true)
    expect(MealLogService.createMealLog).toHaveBeenCalled()

    // 5. Recalculation & Workflow Resolution
    WorkflowStateService.completeWorkflow(householdId, wf.workflow_instance_id)
    const activeWorkflows = WorkflowStateService.getWorkflows(householdId)
    expect(activeWorkflows.length).toBe(0)
  })

  it('E2E-06: Insight Invalid Before Notification (Pre-delivery Suppression)', () => {
    const expiredInsight = {
      insight_id: 'ins-exp-1',
      insight_type: 'USE_SOON',
      title: 'Expired Milk',
      severity: 'critical',
      confidence: { score: 0.90 },
      expires_at: '2026-08-01T00:00:00Z',
      deduplication_key: 'USE_SOON:milk',
    }

    const notifRes = NotificationScheduler.processInsights(householdId, [expiredInsight])
    expect(notifRes.delivered).toBe(0)
    expect(notifRes.suppressed).toBe(1)
  })

  it('E2E-08: Action Replay & Double Confirmation Idempotency Guard', async () => {
    const actionProposal = {
      capabilityId: 'planner.add_meal',
      payload: { recipeId: 'rec-1', mealType: 'dinner', date: '2026-08-12', headcount: 2 },
    }

    // Execute first action
    const res1 = await ActionExecutionService.executeAction({ householdId, actionProposal })
    expect(res1.alreadyExecuted).toBe(false)

    // Second execution returns alreadyExecuted idempotency response
    const res2 = await ActionExecutionService.executeAction({ householdId, actionProposal })
    expect(res2.success).toBe(true)
    expect(res2.alreadyExecuted).toBe(true)
    expect(MealLogService.createMealLog).toHaveBeenCalledTimes(1)
  })

  it('E2E-09: Cross-Household Isolation Enforcement', () => {
    const householdA = 'hh-tenant-a'
    const householdB = 'hh-tenant-b'

    const insightA = {
      insight_id: 'ins-a',
      insight_type: 'LOW_STOCK',
      severity: 'warning',
      confidence: { score: 0.85 },
      deduplication_key: 'LOW_STOCK:sugar',
    }

    // Create notification for Tenant A
    NotificationService.createNotificationFromInsight(insightA, householdA, { eligible: true, mode: 'IMMEDIATE' })

    // Tenant B queries notifications
    const notifsB = NotificationService.getNotifications(householdB)
    expect(notifsB.length).toBe(0)

    const notifsA = NotificationService.getNotifications(householdA)
    expect(notifsA.length).toBe(1)
  })
})
