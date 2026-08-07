/**
 * Pure computation of ingredient availability against current inventory — no I/O. Feeds the
 * Ingredient Availability module (✓ available / ⚠ low / ✕ missing) on the Recipe Detail page.
 */
export const AVAILABILITY_STATUS = {
  AVAILABLE: 'available',
  LOW: 'low',
  MISSING: 'missing',
}

/**
 * @param {Array<{canonical_name: string, quantity_grams: number, is_optional?: boolean}>} requiredIngredients
 * @param {Array<{canonical_name: string, quantity_grams: number, low_stock_threshold?: number}>} inventoryItems
 * @returns {Array<{canonical_name, requiredGrams, availableGrams, remainingAfterCookGrams, shortfallGrams, status, isOptional}>}
 */
export function computeIngredientAvailability(requiredIngredients = [], inventoryItems = []) {
  const inventoryByName = new Map(
    inventoryItems.filter((item) => item?.canonical_name).map((item) => [item.canonical_name.toLowerCase().trim(), item])
  )

  return requiredIngredients.map((req) => {
    const inventoryItem = inventoryByName.get((req.canonical_name || '').toLowerCase().trim())
    const availableGrams = Number(inventoryItem?.quantity_grams) || 0
    const requiredGrams = Number(req.quantity_grams) || 0
    const shortfallGrams = Math.max(0, requiredGrams - availableGrams)
    const remainingAfterCookGrams = Math.max(0, availableGrams - requiredGrams)

    let status
    if (availableGrams <= 0) {
      status = AVAILABILITY_STATUS.MISSING
    } else if (shortfallGrams > 0) {
      status = AVAILABILITY_STATUS.LOW
    } else if (remainingAfterCookGrams <= (Number(inventoryItem?.low_stock_threshold) || 0)) {
      // Enough for this recipe, but cooking it would leave the pantry at/under its own low-stock threshold.
      status = AVAILABILITY_STATUS.LOW
    } else {
      status = AVAILABILITY_STATUS.AVAILABLE
    }

    return {
      canonical_name: req.canonical_name,
      requiredGrams,
      availableGrams,
      remainingAfterCookGrams,
      shortfallGrams,
      status,
      isOptional: Boolean(req.is_optional),
    }
  })
}

/**
 * @param {Array<ReturnType<typeof computeIngredientAvailability>[number]>} availabilityRows
 * @returns {{ available: number, low: number, missing: number, total: number, canCookFully: boolean }}
 */
export function summarizeAvailability(availabilityRows = []) {
  const summary = { available: 0, low: 0, missing: 0, total: availabilityRows.length }
  availabilityRows.forEach((row) => {
    summary[row.status] = (summary[row.status] || 0) + 1
  })
  summary.canCookFully = availabilityRows.every((row) => row.isOptional || row.status !== AVAILABILITY_STATUS.MISSING)
  return summary
}
