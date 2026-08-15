// Deterministic, unit-aware inventory quantity display. No LLM, no qualitative buckets —
// see andaaza.js for the legacy qualitative formatter this replaces for scanned-bill items.

function formatNumber(n, maxDecimals = 3) {
  const rounded = parseFloat(Number(n).toFixed(maxDecimals))
  return String(rounded)
}

function formatUnitLabel(unit) {
  const u = (unit || '').toLowerCase().trim()
  return u === 'l' ? 'L' : u
}

/**
 * Formats an inventory item's quantity using its semantic fields (base_unit, pack_size,
 * pack_unit, purchase_quantity, remaining_quantity, quantity_grams). Returns null when no
 * semantic data is available (item.base_unit is null) — callers must fall back to the
 * legacy qualitative formatter (gramsToAndaaza) for those rows, never guess.
 *
 * @param {Object} item - an inventory row (or enriched item) with base_unit/quantity_grams/etc
 * @returns {{ primary: string, secondary: string|null } | null}
 */
export function formatInventoryQuantity(item) {
  if (!item || item.base_unit == null || item.quantity_grams == null) return null

  const baseUnit = item.base_unit
  const qty = Number(item.quantity_grams) || 0
  const packSize = item.pack_size != null ? Number(item.pack_size) : null
  const packUnit = item.pack_unit

  // Packaged: N pcs × P unit / Total: X unit
  if (packSize != null && packSize > 0 && packUnit === baseUnit) {
    const count = item.remaining_quantity != null ? Number(item.remaining_quantity) : qty / packSize
    const unitLabel = formatUnitLabel(packUnit)
    return {
      primary: `${formatNumber(count)} pcs × ${formatNumber(packSize)} ${unitLabel}`,
      secondary: `Total: ${formatNumber(qty)} ${unitLabel}`,
    }
  }

  if (baseUnit === 'pcs') {
    return { primary: `${formatNumber(qty)} pcs`, secondary: null }
  }

  if (baseUnit === 'g') {
    return qty >= 1000
      ? { primary: `${formatNumber(qty / 1000)} kg`, secondary: null }
      : { primary: `${formatNumber(qty)} g`, secondary: null }
  }

  if (baseUnit === 'ml') {
    return qty >= 1000
      ? { primary: `${formatNumber(qty / 1000)} L`, secondary: null }
      : { primary: `${formatNumber(qty)} ml`, secondary: null }
  }

  return { primary: `${formatNumber(qty)} ${baseUnit}`, secondary: null }
}
