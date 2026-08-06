import { env } from '@/config/env.config'
import { normalizeError } from '@/utils/errors'

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const OCR_PROMPT = `You are extracting grocery items from an Indian supermarket or store bill photograph.
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
      "quantity": number only (default 1 if unstated),
      "unit": "g / kg / ml / L / pcs",
      "price": number only (cost of item),
      "category": "one of Staples / Fresh & Vegetables / Non-Veg / Dairy / Spices / Miscellaneous",
      "confidence": "high or low"
    }
  ]
}

Rules:
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
   * @returns {Promise<{ merchant: string|null, billDate: string|null, totalAmount: number|null, items: Array<Object> }>}
   */
  async scanBill(base64Image, mimeType = 'image/jpeg') {
    const apiKey = env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      throw normalizeError('Gemini API key not configured', 'OCR_CONFIG_ERROR')
    }

    if (!base64Image) {
      throw normalizeError('No image provided for bill scanning', 'OCR_INVALID_INPUT')
    }

    let response
    try {
      response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
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
      })
    } catch (err) {
      throw normalizeError(err, 'OCR_NETWORK_ERROR')
    }

    if (!response.ok) {
      throw normalizeError(`Gemini Vision API error (${response.status})`, 'OCR_API_ERROR', response.status)
    }

    let rawText = ''
    try {
      const data = await response.json()
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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

    // Normalize output format
    return this._normalizeScanOutput(parsedResult)
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
      const quantity = Number(item.quantity || item.quantity_value) || 1
      const price = item.price !== null && item.price !== undefined ? Number(item.price) : null
      const unit = (item.unit || item.andaaza_unit || 'g').toString().toLowerCase().trim()

      return {
        itemName: item.itemName || item.alias_name || 'Unknown Item',
        canonicalName: item.canonicalName || item.canonical_name || item.itemName || item.alias_name || 'Unknown Item',
        quantity: quantity,
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
