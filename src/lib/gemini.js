const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const OCR_PROMPT = `You are extracting grocery items from an Indian supermarket bill photograph.
Return ONLY a JSON array. No preamble. No explanation. No markdown backticks.

For each item extracted return:
{
  "alias_name": "exact text as it appears on bill",
  "canonical_name": "common kitchen name (TATA SALT 1KG → Salt, FORTUNE OIL 1L → Cooking Oil)",
  "quantity_value": number only,
  "unit": "g / kg / ml / L / pcs",
  "unit_grams": convert everything to grams or ml as a number,
  "price": number only,
  "category": "one of Staples / Fresh & Vegetables / Non-Veg / Dairy / Spices / Miscellaneous",
  "confidence": "high or low"
}

Rules:
- Mark confidence LOW if: name is ambiguous, quantity unclear, category uncertain
- Ignore: discount lines, tax lines, total lines, store name, address, date
- The bill may be Hindi, English or mixed — handle all
- Return empty array [] if nothing readable`

export async function scanBill(base64Image, mimeType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return { error: 'Gemini API key not configured' }

  let response
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: OCR_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    })
  } catch {
    return { error: 'Could not reach Gemini — check your connection' }
  }

  if (!response.ok) {
    return { error: `Gemini error ${response.status}` }
  }

  const data = await response.json()
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  // Strip markdown fences if Gemini wraps them despite the prompt
  text = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()

  let items
  try {
    items = JSON.parse(text)
  } catch {
    return { error: 'Could not read bill' }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'No items found' }
  }

  return { items }
}
