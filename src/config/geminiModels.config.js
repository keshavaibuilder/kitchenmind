import { env } from './env.config.js'

/**
 * Static capability registry for Gemini models.
 *
 * This is a frontend-only architecture with no live model-capability discovery endpoint, so
 * eligibility is asserted here (per the account's confirmed available model list) rather than
 * probed at runtime. Only generateContent-capable, multimodal (image input) models belong here —
 * embedding, TTS, image-generation, and other non-generateContent model families are deliberately
 * absent; they were never candidates for the OCR pool and must never be routed an image request.
 */
export const GEMINI_MODEL_CAPABILITIES = {
  'gemini-3.7-flash': { supportsVision: true },
  'gemini-3.6-flash': { supportsVision: true },
  'gemini-3.5-flash': { supportsVision: true },
  'gemini-flash-latest': { supportsVision: true },
  'gemini-3.1-flash-lite': { supportsVision: true },
  'gemini-3.1-flash-lite-preview': { supportsVision: true },
  'gemini-2.5-flash': { supportsVision: true },
  'gemini-2.5-flash-lite': { supportsVision: true },
  'gemini-3.1-pro-preview': { supportsVision: true },
  'gemini-pro-latest': { supportsVision: true },
  'gemini-2.5-pro': { supportsVision: true },
}

// Ordering is a starting point, not a claim that gemini-3.7-flash is objectively best for OCR —
// see scripts/benchmark-gemini-ocr-models.mjs for the tool intended to inform reordering this.
const DEFAULT_OCR_MODEL_POOL = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
]

function isVisionCapable(model) {
  return Boolean(GEMINI_MODEL_CAPABILITIES[model]?.supportsVision)
}

function parseModelList(raw) {
  if (!raw) return null
  const models = raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  return models.length > 0 ? models : null
}

// VITE_GEMINI_OCR_MODELS overrides the default pool/order (comma-separated model IDs), following
// this repo's existing VITE_-prefixed env convention (env.config.js) so Vite actually inlines it
// into the client bundle — a bare GEMINI_OCR_MODELS var would never reach browser code. Configured
// models absent from the vision-capability registry above are silently dropped rather than routed
// to, so a typo or an unsupported model name in config can't send an image request to a model that
// can't accept one.
const configuredPool = parseModelList(env.GEMINI_OCR_MODELS) || DEFAULT_OCR_MODEL_POOL

export const OCR_MODEL_POOL = configuredPool.filter(isVisionCapable)

// Keyed by task so this can extend to other Gemini call sites later without a redesign — only
// bill_ocr is wired up today.
export const GEMINI_TASKS = {
  bill_ocr: {
    models: OCR_MODEL_POOL,
    requiresVision: true,
  },
}
