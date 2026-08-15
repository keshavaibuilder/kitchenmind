import { env } from '@/config/env.config'
import { normalizeError } from '@/utils/errors'
import { GeminiModelRouter } from './GeminiModelRouter.js'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const OCR_TASK = 'bill_ocr'

// Gemini's shared capacity intermittently returns 429/503 for slow, heavy requests (long
// extraction prompt + full-resolution photo) even when the payload itself is fine — confirmed by
// live diagnostic: the exact same request succeeded once and 503'd on immediate retry with no
// payload change. These are the only two statuses that trigger failover to another model; anything
// else (e.g. a 404 from a bad model name) is a real client-side error and must fail immediately,
// not be masked by retries or hidden behind a model switch.
const MAX_TOTAL_ATTEMPTS = 3
const INTER_ATTEMPT_DELAY_MS = 500
const RETRYABLE_STATUSES = new Set([429, 503])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Best-effort parse of how long to respect a 429 for, preferring the standard HTTP header and
 * falling back to Gemini's error-body RetryInfo (`error.details[].retryDelay`, e.g. "35s").
 * Never throws — a missing/unparseable delay just means the router falls back to its own backoff.
 */
function parseRetryAfterMs(response, bodyText) {
  const header = response.headers?.get?.('Retry-After')
  if (header) {
    const asSeconds = Number(header)
    if (!isNaN(asSeconds)) return asSeconds * 1000
    const asDate = Date.parse(header)
    if (!isNaN(asDate)) return Math.max(0, asDate - Date.now())
  }
  try {
    const parsed = JSON.parse(bodyText)
    const details = parsed?.error?.details
    const retryInfo = Array.isArray(details) ? details.find((d) => typeof d?.retryDelay === 'string') : null
    const match = retryInfo ? /^([\d.]+)s$/.exec(retryInfo.retryDelay) : null
    if (match) return Math.round(parseFloat(match[1]) * 1000)
  } catch {
    // best-effort only — a malformed error body shouldn't break failover
  }
  return null
}

// Exported so the optional live model-benchmark script (scripts/benchmark-gemini-ocr-models.mjs)
// can reuse the real, canonical prompt instead of duplicating it — one prompt, everywhere.
export const OCR_PROMPT = `You are extracting grocery items from an Indian supermarket or store bill photograph.
Return ONLY a JSON object. No preamble. No explanation. No markdown backticks.

Structure your output exactly as follows:
{
  "merchant": "Store / Supermarket name if visible, or null",
  "billDate": "YYYY-MM-DD format if date is visible, or null",
  "totalAmount": number only representing total bill amount if visible, or null,
  "items": [
    {
      "itemName": "exact text as it appears on bill",
      "canonicalName": "common kitchen name (e.g. TATA SALT 1KG -> Salt, FORTUNE OIL 1L -> Cooking Oil)",
      "purchaseQuantity": number of packs/units bought, read from the receipt's own quantity/qty column (default 1 if the bill shows no separate quantity column),
      "packSize": the size of ONE pack as printed in the product name/label (e.g. "MUSTARD OIL-5lt" -> 5, "TEA GOLD-250g" -> 250, "ACTI-4.18kg" -> 4.18, "MANGO-1200ml" -> 1200). Set this to null when the item has NO printed pack size and is instead sold loose/weighed (e.g. raw rice, dal, vegetables, spices bought by total weight) — for those items purchaseQuantity IS already the total weight/volume purchased.
      "unit": "g / kg / ml / L / pcs — the unit that packSize (or purchaseQuantity, when packSize is null) is measured in",
      "price": number only (cost of item),
      "category": "one of Staples / Fresh & Vegetables / Non-Veg / Dairy / Spices / Miscellaneous",
      "confidence": "high or low"
    }
  ]
}

Rules:
- Never multiply purchaseQuantity by packSize yourself — report them separately exactly as they appear on the bill; the total is computed downstream, not by you.
- Mark confidence "low" if: name is ambiguous, quantity unclear, or category uncertain.
- Ignore discount lines, tax lines, cashier info, store address, or payment method unless computing item price.
- The bill may be in English, Hindi, or mixed — handle all.
- If no readable grocery items are present, return { "merchant": null, "billDate": null, "totalAmount": null, "items": [] }.`

/**
 * OCRService
 * Framework-agnostic service for bill receipt scanning and AI extraction.
 * Standardized error handling and plain JS object returns.
 */
export const OCRService = {
  /**
   * Scans a receipt image via Gemini Vision API and returns normalized bill data.
   * Type: External API Service Call
   * Target for Future Migration: Supabase Edge Function (/functions/v1/scan-bill) to keep API keys on the server.
   * 
   * @param {string} base64Image - Base64 encoded image string (without data URL prefix)
   * @param {string} [mimeType='image/jpeg'] - Image MIME type
   * @returns {Promise<{ merchant: string|null, billDate: string|null, totalAmount: number|null, items: Array<{ itemName: string, canonicalName: string, purchaseQuantity: number, packSize: number|null, quantity: number, unit: string, price: number|null, category: string, confidence: string }> }>}
   */
  async scanBill(base64Image, mimeType = 'image/jpeg') {
    const apiKey = env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      throw normalizeError('Gemini API key not configured', 'OCR_CONFIG_ERROR')
    }

    if (!base64Image) {
      throw normalizeError('No image provided for bill scanning', 'OCR_INVALID_INPUT')
    }

    const requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: OCR_PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    }

    const triedModels = []

    for (let attempt = 1; attempt <= MAX_TOTAL_ATTEMPTS; attempt++) {
      const model = GeminiModelRouter.selectModel({ task: OCR_TASK, excludeModels: triedModels })
      if (!model) break
      triedModels.push(model)

      if (attempt > 1) {
        await sleep(INTER_ATTEMPT_DELAY_MS)
      }

      let response
      try {
        response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, requestInit)
      } catch (err) {
        // Network failures are not model-specific and not currently treated as transient —
        // preserving prior behavior exactly: immediate throw, no retry, no failover.
        throw normalizeError(err, 'OCR_NETWORK_ERROR')
      }

      if (response.ok) {
        GeminiModelRouter.recordSuccess(model)
        GeminiModelRouter.logAttempt({ task: OCR_TASK, model, attempt, status: response.status, action: 'success' })
        // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
        console.info('[OCRService] Gemini success', { model, attempt })
        return await this._parseAndNormalize(response)
      }

      const isRetryable = RETRYABLE_STATUSES.has(response.status)

      if (!isRetryable) {
        GeminiModelRouter.recordFailure(model, response.status)
        GeminiModelRouter.logAttempt({ task: OCR_TASK, model, attempt, status: response.status, action: 'terminal_error' })
        throw normalizeError(`Gemini Vision API error (${response.status})`, 'OCR_API_ERROR', response.status)
      }

      const bodyText = await response.text().catch(() => '')
      const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response, bodyText) : null
      GeminiModelRouter.recordFailure(model, response.status, retryAfterMs)
      GeminiModelRouter.logAttempt({
        task: OCR_TASK,
        model,
        attempt,
        status: response.status,
        action: attempt < MAX_TOTAL_ATTEMPTS ? 'failover' : 'exhausted',
      })
    }

    // Every eligible model either failed transiently (429/503) or the pool ran out of eligible
    // models within the bounded attempt budget — a user-facing message that doesn't name Gemini
    // or leak a status code, per the UX requirement that transient failover stay invisible.
    throw normalizeError(
      'Bill processing is temporarily unavailable. Your bill has not been lost. Please try again shortly.',
      'OCR_MODEL_POOL_EXHAUSTED'
    )
  },

  /**
   * Parses a successful Gemini response body and normalizes it into the OCR output contract.
   * @private
   */
  async _parseAndNormalize(response) {
    let rawText = ''
    try {
      const data = await response.json()
      const parts = data?.candidates?.[0]?.content?.parts
      rawText = parts?.[0]?.text ?? ''
      // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
      // Only shape/lengths, never the actual receipt text.
      console.info('[OCRService] raw response shape', {
        finishReason: data?.candidates?.[0]?.finishReason,
        partCount: Array.isArray(parts) ? parts.length : 0,
        partTypes: Array.isArray(parts) ? parts.map((p) => Object.keys(p)) : [],
        part0TextLength: rawText.length,
      })
    } catch (err) {
      throw normalizeError(err, 'OCR_RESPONSE_PARSE_ERROR')
    }

    // Clean JSON response (strip markdown fences if present)
    const cleanedText = rawText.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsedResult
    try {
      parsedResult = JSON.parse(cleanedText)
    } catch (err) {
      throw normalizeError('Could not parse bill data from OCR output', 'OCR_JSON_PARSE_ERROR', null, err)
    }

    const normalized = this._normalizeScanOutput(parsedResult)
    // TEMPORARY DIAGNOSTIC — remove after the ScanBill review-state bug is confirmed/fixed.
    console.info('[OCRService] normalized result', { itemCount: normalized?.items?.length, keys: Object.keys(normalized || {}) })
    return normalized
  },

  /**
   * Internal helper to normalize Gemini parsed result into standard output contract.
   * @private
   * @param {any} raw
   * @returns {{ merchant: string|null, billDate: string|null, totalAmount: number|null, items: Array<Object> }}
   */
  _normalizeScanOutput(raw) {
    let merchant = null
    let billDate = null
    let totalAmount = null
    let rawItems = []

    if (Array.isArray(raw)) {
      rawItems = raw
    } else if (raw && typeof raw === 'object') {
      merchant = typeof raw.merchant === 'string' ? raw.merchant : null
      billDate = typeof raw.billDate === 'string' ? raw.billDate : null
      totalAmount = typeof raw.totalAmount === 'number' ? raw.totalAmount : null
      rawItems = Array.isArray(raw.items) ? raw.items : []
    }

    if (rawItems.length === 0) {
      throw normalizeError('No readable grocery items found on the bill', 'OCR_NO_ITEMS_FOUND')
    }

    const items = rawItems.map((item) => {
      // purchaseQuantity/packSize are the OCR-native primitives (how many packs were bought,
      // how big is one pack) — deliberately NOT asking Gemini to multiply them itself (LLM
      // arithmetic on OCR'd numbers is unreliable). The single authoritative total quantity
      // downstream code expects is always computed here, not trusted directly from the model.
      const purchaseQuantity = Number(item.purchaseQuantity ?? item.quantity ?? item.quantity_value) || 1
      const rawPackSize = item.packSize
      const packSize =
        rawPackSize === null || rawPackSize === undefined || rawPackSize === '' ? null : Number(rawPackSize)
      const hasPackSize = typeof packSize === 'number' && !isNaN(packSize) && packSize > 0
      const unit = (item.unit || item.andaaza_unit || 'g').toString().toLowerCase().trim()
      const totalQuantity = hasPackSize ? purchaseQuantity * packSize : purchaseQuantity
      const price = item.price !== null && item.price !== undefined ? Number(item.price) : null

      return {
        itemName: item.itemName || item.alias_name || 'Unknown Item',
        canonicalName: item.canonicalName || item.canonical_name || item.itemName || item.alias_name || 'Unknown Item',
        purchaseQuantity: purchaseQuantity,
        packSize: hasPackSize ? packSize : null,
        quantity: totalQuantity,
        unit: unit,
        price: price,
        category: item.category || 'Miscellaneous',
        confidence: item.confidence === 'high' ? 'high' : 'low',
      }
    })

    // Compute totalAmount from item prices if not explicitly extracted
    if (totalAmount === null) {
      const sum = items.reduce((acc, curr) => acc + (curr.price || 0), 0)
      if (sum > 0) totalAmount = sum
    }

    return {
      merchant,
      billDate,
      totalAmount,
      items,
    }
  },
}
