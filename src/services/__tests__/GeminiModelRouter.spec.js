import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GeminiModelRouter } from '../GeminiModelRouter.js'
import { OCR_MODEL_POOL } from '../../config/geminiModels.config.js'

describe('GeminiModelRouter', () => {
  beforeEach(() => {
    GeminiModelRouter._resetHealth()
  })

  afterEach(() => {
    vi.useRealTimers()
    GeminiModelRouter._resetHealth()
  })

  it('selectModel returns the first pool model in order when all are healthy', () => {
    const model = GeminiModelRouter.selectModel({ task: 'bill_ocr' })
    expect(model).toBe(OCR_MODEL_POOL[0])
  })

  it('selectModel returns null for an unknown task', () => {
    const model = GeminiModelRouter.selectModel({ task: 'not_a_real_task' })
    expect(model).toBeNull()
  })

  it('selectModel skips explicitly excluded models', () => {
    const model = GeminiModelRouter.selectModel({ task: 'bill_ocr', excludeModels: [OCR_MODEL_POOL[0]] })
    expect(model).toBe(OCR_MODEL_POOL[1])
  })

  it('recordSuccess clears prior failure state for a model', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    expect(GeminiModelRouter.isInCooldown(OCR_MODEL_POOL[0])).toBe(true)

    GeminiModelRouter.recordSuccess(OCR_MODEL_POOL[0])
    const snapshot = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snapshot.consecutiveFailures).toBe(0)
    expect(snapshot.cooldownUntil).toBeNull()
    expect(GeminiModelRouter.isInCooldown(OCR_MODEL_POOL[0])).toBe(false)
  })

  it('a 503 failure puts the model into a short bounded cooldown', () => {
    vi.useFakeTimers()
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    expect(GeminiModelRouter.isInCooldown(OCR_MODEL_POOL[0])).toBe(true)

    vi.advanceTimersByTime(3001)
    expect(GeminiModelRouter.isInCooldown(OCR_MODEL_POOL[0])).toBe(false)
  })

  it('503 cooldown grows with consecutive failures but stays bounded at 15s', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    let snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(3000)

    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(6000)

    for (let i = 0; i < 10; i++) GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(15000)
  })

  it('a 429 failure without a server retry delay uses bounded exponential backoff', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 429)
    let snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(1000)

    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 429)
    snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(2000)

    for (let i = 0; i < 10; i++) GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 429)
    snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(30000)
  })

  it('a 429 failure with a server retry delay respects it, bounded at 120s', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 429, 5000)
    let snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(5000)

    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 429, 999999999)
    snap = GeminiModelRouter.getHealthSnapshot(OCR_MODEL_POOL[0])
    expect(snap.cooldownUntil - snap.lastFailureAt).toBe(120000)
  })

  it('a non-retryable status (e.g. 404) permanently deprioritizes the model for the session', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 404)
    expect(GeminiModelRouter.isInCooldown(OCR_MODEL_POOL[0])).toBe(true)

    const model = GeminiModelRouter.selectModel({ task: 'bill_ocr' })
    expect(model).toBe(OCR_MODEL_POOL[1])
  })

  it('selectModel falls through to a later pool model when earlier ones are cooling down', () => {
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[0], 503)
    GeminiModelRouter.recordFailure(OCR_MODEL_POOL[1], 429)

    const model = GeminiModelRouter.selectModel({ task: 'bill_ocr' })
    expect(model).toBe(OCR_MODEL_POOL[2])
  })

  it('selectModel returns null when every pool model is cooling down or excluded', () => {
    for (const model of OCR_MODEL_POOL) {
      GeminiModelRouter.recordFailure(model, 503)
    }
    expect(GeminiModelRouter.selectModel({ task: 'bill_ocr' })).toBeNull()
  })
})
