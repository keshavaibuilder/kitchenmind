/**
 * Centralized Client Logger with Structured Observability Context
 */

const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
const IS_DEV = Boolean(metaEnv.DEV) || process.env.NODE_ENV === 'development'

/**
 * Sanitizes object metadata to prevent accidental leakage of PII or sensitive keys.
 * @param {Object} metadata 
 * @returns {Object}
 */
function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {}
  const sanitized = { ...metadata }
  delete sanitized.imageBase64
  delete sanitized.password
  delete sanitized.apiKey
  delete sanitized.token
  return sanitized
}

export const logger = {
  info: (message, metadata = {}) => {
    if (IS_DEV || process.env.ENABLE_LOGGING) {
      console.log(`[INFO] ${message}`, sanitizeMetadata(metadata))
    }
  },
  warn: (message, metadata = {}) => {
    console.warn(`[WARN] ${message}`, sanitizeMetadata(metadata))
  },
  error: (message, metadata = {}) => {
    console.error(`[ERROR] ${message}`, sanitizeMetadata(metadata))
  },
  
  /**
   * Log structured telemetry for persistence and RPC operations
   */
  logCommitTelemetry: (event, { requestId, householdId, billId, commitId, executionTime, isDuplicate, rollbackReason, aiHookStatus }) => {
    const telemetryPayload = {
      event,
      timestamp: new Date().toISOString(),
      requestId: requestId || null,
      householdId: householdId || null,
      billId: billId || null,
      commitId: commitId || null,
      executionTimeMs: executionTime ? Number(executionTime.toFixed(2)) : null,
      isDuplicate: Boolean(isDuplicate),
      rollbackReason: rollbackReason || null,
      aiHookStatus: aiHookStatus || 'PENDING',
    }
    console.log(`[TELEMETRY] ${event}`, telemetryPayload)
  },
}
