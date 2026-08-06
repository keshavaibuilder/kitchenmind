import { supabaseClient } from './supabaseClient'
import { normalizeError } from '@/utils/errors'

/**
 * Normalizes a string by stripping pack sizes (e.g., "1kg", "500g", "1L"), punctuation, and extra whitespace.
 * @param {string} str 
 * @returns {string}
 */
function normalizeString(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(kg|g|gm|gms|ml|l|ltr|ltrs|pcs|pc|pack|pkt)\b/gi, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * IngredientMatchingService
 * Framework-agnostic service for matching OCR item strings against canonical ingredient aliases.
 * Read-only operations. Never writes to DB, never calls Gemini.
 */
export const IngredientMatchingService = {
  /**
   * Matches a single OCR item to the canonical ingredient master.
   * Type: Simple CRUD / Lookup
   * 
   * @param {Object} ocrItem - Single OCR item { itemName, canonicalName, category, price, quantity, unit, confidence }
   * @returns {Promise<{ ingredientId: string|null, canonicalName: string, matchedAlias: string|null, confidence: string, confidenceScore: number, requiresManualReview: boolean, originalItem: Object }>}
   */
  async matchItem(ocrItem) {
    if (!ocrItem || (!ocrItem.itemName && !ocrItem.canonicalName)) {
      throw normalizeError('Invalid item passed to IngredientMatchingService', 'MATCHING_INVALID_INPUT')
    }

    const rawName = (ocrItem.itemName || ocrItem.canonicalName || '').trim()
    const cleaned = normalizeString(rawName)

    try {
      // ── Step 1: Exact alias match ──────────────────────────────────────
      const { data: exactMatch } = await supabaseClient
        .from('ingredient_aliases')
        .select('id, alias_name, canonical_name')
        .eq('alias_name', rawName)
        .maybeSingle()

      if (exactMatch) {
        return {
          ingredientId: exactMatch.id,
          canonicalName: exactMatch.canonical_name,
          matchedAlias: exactMatch.alias_name,
          confidence: 'HIGH',
          confidenceScore: 1.0,
          requiresManualReview: false,
          originalItem: ocrItem,
        }
      }

      // ── Step 2: Case-insensitive alias match ───────────────────────────
      const { data: caseMatch } = await supabaseClient
        .from('ingredient_aliases')
        .select('id, alias_name, canonical_name')
        .ilike('alias_name', rawName)
        .maybeSingle()

      if (caseMatch) {
        return {
          ingredientId: caseMatch.id,
          canonicalName: caseMatch.canonical_name,
          matchedAlias: caseMatch.alias_name,
          confidence: 'HIGH',
          confidenceScore: 0.95,
          requiresManualReview: false,
          originalItem: ocrItem,
        }
      }

      // ── Step 3: Normalized string match (alias or canonical) ───────────
      if (cleaned.length > 2) {
        const { data: normMatch } = await supabaseClient
          .from('ingredient_aliases')
          .select('id, alias_name, canonical_name')
          .ilike('alias_name', `%${cleaned}%`)
          .maybeSingle()

        if (normMatch) {
          return {
            ingredientId: normMatch.id,
            canonicalName: normMatch.canonical_name,
            matchedAlias: normMatch.alias_name,
            confidence: 'MEDIUM',
            confidenceScore: 0.75,
            requiresManualReview: false,
            originalItem: ocrItem,
          }
        }
      }

      // ── Step 4: OCR Canonical Name fallback / Low-confidence review ──
      const isOcrHighConf = ocrItem.confidence === 'high'
      const fallbackCanonical = ocrItem.canonicalName || ocrItem.itemName || 'Unknown Ingredient'

      return {
        ingredientId: null,
        canonicalName: fallbackCanonical,
        matchedAlias: null,
        confidence: isOcrHighConf ? 'MEDIUM' : 'LOW',
        confidenceScore: isOcrHighConf ? 0.70 : 0.30,
        requiresManualReview: !isOcrHighConf,
        originalItem: ocrItem,
      }
    } catch (err) {
      throw normalizeError(err, 'INGREDIENT_MATCHING_FAILED')
    }
  },

  /**
   * Matches a batch of OCR items in parallel.
   * Type: Simple CRUD / Batch Lookup
   * 
   * @param {Array<Object>} ocrItems - Array of OCR item objects
   * @returns {Promise<Array<Object>>} Resolved items array
   */
  async matchItemsBatch(ocrItems = []) {
    if (!Array.isArray(ocrItems)) return []
    try {
      const results = await Promise.all(
        ocrItems.map((item) => this.matchItem(item))
      )
      return results
    } catch (err) {
      throw normalizeError(err, 'INGREDIENT_BATCH_MATCHING_FAILED')
    }
  },
}
