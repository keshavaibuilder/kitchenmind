import { WORKFLOW_STATUS } from './workflowRegistry.js'

const WORKFLOW_STORAGE_PREFIX = 'km_workflows_'

export const WorkflowStateService = {
  /**
   * Loads all active/non-dismissed workflow instances for a household.
   * @param {string} householdId
   * @returns {Array<Object>}
   */
  getWorkflows(householdId) {
    if (!householdId) return []
    try {
      const raw = localStorage.getItem(`${WORKFLOW_STORAGE_PREFIX}${householdId}`)
      if (!raw) return []
      const arr = JSON.parse(raw)
      const now = new Date()
      return (Array.isArray(arr) ? arr : [])
        .filter((w) => w.status !== WORKFLOW_STATUS.DISMISSED)
        .filter((w) => !w.expires_at || new Date(w.expires_at) > now)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    } catch {
      return []
    }
  },

  /**
   * Checks whether a cooldown is active for a given workflow definition and entity.
   *
   * @param {string} householdId
   * @param {string} workflowId Definition ID (e.g. WF-01-DEPLETION-SHOPPING)
   * @param {string} entityKey Unique entity key (e.g. 'basmati rice')
   * @param {number} cooldownHours Cooldown duration in hours
   * @param {Date} [nowDate]
   * @returns {boolean}
   */
  isCooldownActive(householdId, workflowId, entityKey = '', cooldownHours = 24, nowDate = new Date()) {
    if (!householdId || !workflowId) return false
    try {
      const raw = localStorage.getItem(`${WORKFLOW_STORAGE_PREFIX}${householdId}`)
      if (!raw) return false
      const all = JSON.parse(raw) || []
      const cooldownMs = cooldownHours * 3600000

      return all.some((w) => {
        if (w.workflow_id !== workflowId) return false
        if (entityKey && w.related_entities?.canonicalName?.toLowerCase() !== entityKey.toLowerCase()) {
          return false
        }
        const updatedAt = new Date(w.updated_at || w.created_at)
        return nowDate - updatedAt < cooldownMs
      })
    } catch {
      return false
    }
  },

  /**
   * Marks a workflow instance as DISMISSED and records timestamp for cooldown enforcement.
   * @param {string} householdId
   * @param {string} workflowInstanceId
   */
  dismissWorkflow(householdId, workflowInstanceId) {
    if (!householdId || !workflowInstanceId) return
    const list = this.getWorkflows(householdId)
    const nowIso = new Date().toISOString()
    const updated = list.map((w) => {
      if (w.workflow_instance_id === workflowInstanceId) {
        return { ...w, status: WORKFLOW_STATUS.DISMISSED, updated_at: nowIso }
      }
      return w
    })
    this._save(householdId, updated)
  },

  /**
   * Marks a workflow instance as COMPLETED following user action execution.
   * @param {string} householdId
   * @param {string} workflowInstanceId
   */
  completeWorkflow(householdId, workflowInstanceId) {
    if (!householdId || !workflowInstanceId) return
    const list = this.getWorkflows(householdId)
    const nowIso = new Date().toISOString()
    const updated = list.map((w) => {
      if (w.workflow_instance_id === workflowInstanceId) {
        return { ...w, status: WORKFLOW_STATUS.COMPLETED, updated_at: nowIso }
      }
      return w
    })
    this._save(householdId, updated)
  },

  /**
   * Private storage helper.
   */
  _save(householdId, workflows) {
    try {
      localStorage.setItem(`${WORKFLOW_STORAGE_PREFIX}${householdId}`, JSON.stringify(workflows))
    } catch (err) {
      console.warn('[WorkflowStateService] Failed to save workflows:', err)
    }
  },
}
