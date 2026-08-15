import { describe, it, expect } from 'vitest'
import { OCR_MODEL_POOL, GEMINI_MODEL_CAPABILITIES, GEMINI_TASKS } from '../geminiModels.config.js'

describe('geminiModels.config', () => {
  it('default OCR pool matches the proposed primary + fallback order', () => {
    expect(OCR_MODEL_POOL).toEqual([
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
    ])
  })

  it('every model in the OCR pool is marked vision-capable in the registry', () => {
    for (const model of OCR_MODEL_POOL) {
      expect(GEMINI_MODEL_CAPABILITIES[model]?.supportsVision).toBe(true)
    }
  })

  it('does not include embedding models in the capability registry', () => {
    expect(GEMINI_MODEL_CAPABILITIES['gemini-embedding-2']).toBeUndefined()
    expect(GEMINI_MODEL_CAPABILITIES['gemini-embedding-2-preview']).toBeUndefined()
    expect(GEMINI_MODEL_CAPABILITIES['gemini-embedding-001']).toBeUndefined()
  })

  it('does not include experimental/non-generateContent-OCR models in the registry', () => {
    expect(GEMINI_MODEL_CAPABILITIES['gemma-4-31b-it']).toBeUndefined()
    expect(GEMINI_MODEL_CAPABILITIES['gemma-4-26b-a4b-it']).toBeUndefined()
    expect(GEMINI_MODEL_CAPABILITIES['gemini-omni-flash-preview']).toBeUndefined()
  })

  it('wires the bill_ocr task to the OCR pool and requires vision', () => {
    expect(GEMINI_TASKS.bill_ocr.models).toBe(OCR_MODEL_POOL)
    expect(GEMINI_TASKS.bill_ocr.requiresVision).toBe(true)
  })
})
