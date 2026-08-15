import { GEMINI_TASKS } from '../config/geminiModels.config.js'
import { logger } from '../utils/logger.js'

/**
 * GeminiModelRouter
 *
 * Selects an eligible Gemini model for a task and tracks per-model health in memory, so a bill
 * scan fails over across models on transient errors instead of hammering one unavailable model.
 * This is model failover and transient-error resilience — NOT a quota bypass: different model
 * names do not necessarily draw from independent project-level quota, so if the project's quota
 * is genuinely exhausted, every model in the pool may still return 429.
 *
 * State is a module-level in-memory Map, deliberately not persisted (no DB table, no
 * localStorage) — a browser refresh resetting it is acceptable for this frontend-only
 * architecture; the goal is just to avoid immediately re-hammering a model that just failed
 * within the current tab's session.
 */
const modelHealth = new Map()

const BASE_429_COOLDOWN_MS = 1000
const MAX_429_COOLDOWN_MS = 30000
const MAX_RETRY_AFTER_COOLDOWN_MS = 120000
const BASE_503_COOLDOWN_MS = 3000
const MAX_503_COOLDOWN_MS = 15000

function now() {
  return Date.now()
}

function emptyHealth() {
  return { consecutiveFailures: 0, lastFailureAt: null, cooldownUntil: null, lastStatus: null }
}

function getHealth(model) {
  return modelHealth.get(model) || emptyHealth()
}

export const GeminiModelRouter = {
  /**
   * Returns the next eligible model for a task, skipping models currently in cooldown and any
   * explicitly excluded (e.g. models already tried in the current operation, so one scan never
   * reuses a model that just failed). Returns null if no eligible model remains.
   */
  selectModel({ task, excludeModels = [] } = {}) {
    const taskConfig = GEMINI_TASKS[task]
    if (!taskConfig) return null
    const t = now()
    for (const model of taskConfig.models) {
      if (excludeModels.includes(model)) continue
      const health = modelHealth.get(model)
      if (health?.cooldownUntil && health.cooldownUntil > t) continue
      return model
    }
    return null
  },

  /** Clears failure history for a model on a successful response. */
  recordSuccess(model) {
    modelHealth.set(model, emptyHealth())
  },

  /**
   * Records a failed attempt and puts the model into cooldown.
   * - 429: respects a server-provided retry delay (bounded) when available, else bounded
   *   exponential backoff — this is a rate-limit signal, not "the model is broken."
   * - 503: short bounded cooldown — transient capacity/overload, usually clears quickly.
   * - anything else (400/401/403/404/etc.): permanently deprioritized for the rest of the
   *   session — a non-retryable status means this model/request will never succeed, so there's
   *   no value in trying it again later, only in stopping fast next time.
   */
  recordFailure(model, status, retryAfterMs = null) {
    const prev = getHealth(model)
    const consecutiveFailures = prev.consecutiveFailures + 1
    let cooldownMs

    if (status === 429) {
      cooldownMs =
        retryAfterMs != null
          ? Math.min(retryAfterMs, MAX_RETRY_AFTER_COOLDOWN_MS)
          : Math.min(BASE_429_COOLDOWN_MS * 2 ** (consecutiveFailures - 1), MAX_429_COOLDOWN_MS)
    } else if (status === 503) {
      cooldownMs = Math.min(BASE_503_COOLDOWN_MS * consecutiveFailures, MAX_503_COOLDOWN_MS)
    } else {
      cooldownMs = Infinity
    }

    modelHealth.set(model, {
      consecutiveFailures,
      lastFailureAt: now(),
      cooldownUntil: cooldownMs === Infinity ? Infinity : now() + cooldownMs,
      lastStatus: status,
    })
  },

  isInCooldown(model) {
    const health = modelHealth.get(model)
    return Boolean(health?.cooldownUntil && health.cooldownUntil > now())
  },

  getHealthSnapshot(model) {
    return { ...getHealth(model) }
  },

  /** Structured, PII-free diagnostic log — never pass API keys, headers, or image data here. */
  logAttempt({ task, model, attempt, status, action }) {
    logger.info(`[GeminiRouter] task=${task} model=${model} attempt=${attempt} status=${status ?? 'n/a'} action=${action}`)
  },

  /** Test-only: clears all in-memory health state between test cases. */
  _resetHealth() {
    modelHealth.clear()
  },
}
