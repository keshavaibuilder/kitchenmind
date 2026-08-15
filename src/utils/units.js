/**
 * Shared quantity-to-grams unit conversion. Single source of truth so
 * BillPersistenceService and AndaazaLearningEngine can't silently drift apart.
 */

export function convertToUnitGrams(quantity, unit) {
  const q = Number(quantity) || 1
  const u = (unit || 'g').toLowerCase().trim()

  switch (u) {
    case 'kg':
      return q * 1000
    case 'l':
      return q * 1000
    case 'ml':
      return q
    case 'g':
      return q
    case 'pcs':
      // A count is preserved as-is — there is no universal weight-per-piece conversion (an
      // egg and a potato are not the same number of grams). Fabricating one here previously
      // corrupted inventory data; the caller is responsible for supplying pack_size/pack_unit
      // when a real per-piece weight is actually known (see deriveBaseUnit below).
      return q
    default:
      return q
  }
}

/**
 * Determines the physical scale ('g', 'ml', or 'pcs') a quantity is actually measured in.
 * This is the base_unit persisted alongside quantity_grams/remaining_grams — those columns
 * keep their historical name but represent whichever of these three scales base_unit says.
 * @param {string} unit - raw unit string (e.g. 'kg', 'g', 'l', 'ml', 'pcs')
 * @returns {'g'|'ml'|'pcs'}
 */
export function deriveBaseUnit(unit) {
  const u = (unit || 'g').toLowerCase().trim()
  if (u === 'kg' || u === 'g') return 'g'
  if (u === 'l' || u === 'ml') return 'ml'
  if (u === 'pcs') return 'pcs'
  return 'g'
}

/**
 * Units a caller may express a consumption/deduction request in for a given inventory item,
 * given its base_unit and (optionally) known pack_size/pack_unit. Never includes a unit that
 * would require fabricating an unknown conversion.
 * @param {{ base_unit: string|null, pack_size: number|null, pack_unit: string|null }} item
 * @returns {string[]}
 */
export function getCompatibleConsumptionUnits(item) {
  const baseUnit = item?.base_unit
  const hasPack = item?.pack_size != null && Number(item.pack_size) > 0 && item?.pack_unit === baseUnit

  if (baseUnit === 'g') return hasPack ? ['g', 'kg', 'pcs'] : ['g', 'kg']
  if (baseUnit === 'ml') return hasPack ? ['ml', 'l', 'pcs'] : ['ml', 'l']
  if (baseUnit === 'pcs') return ['pcs']
  return []
}

/**
 * Deterministically converts a user-entered consumption quantity/unit into the item's
 * base_unit scale. Application code only — never an LLM. Throws a normalizeError-compatible
 * Error with a stable `.code` when the unit is incompatible or a required conversion (pack
 * size) is unknown, rather than inventing one.
 * @param {number} quantity
 * @param {string} unit
 * @param {{ base_unit: string|null, pack_size: number|null, pack_unit: string|null }} item
 * @returns {number} quantity expressed in item.base_unit
 */
export function convertConsumptionToBaseUnits(quantity, unit, item) {
  const q = Number(quantity)
  const u = (unit || '').toLowerCase().trim()
  const baseUnit = item?.base_unit
  const packSize = item?.pack_size != null ? Number(item.pack_size) : null
  const packUnit = item?.pack_unit ? item.pack_unit.toLowerCase().trim() : null

  if (!q || q <= 0) {
    throw Object.assign(new Error('Consumption quantity must be greater than 0'), { code: 'CONSUMPTION_INVALID_QUANTITY' })
  }
  if (!baseUnit) {
    throw Object.assign(new Error('This item has no semantic unit data yet — cannot validate a consumption unit'), { code: 'CONSUMPTION_NO_BASE_UNIT' })
  }

  if (u === 'pcs') {
    if (baseUnit === 'pcs') return q
    if (packSize != null && packSize > 0 && packUnit === baseUnit) return q * packSize
    throw Object.assign(
      new Error('This item has no known pack size — "pcs" cannot be converted without fabricating a weight/volume'),
      { code: 'CONSUMPTION_PACK_SIZE_UNKNOWN' }
    )
  }

  if (baseUnit === 'g' && u === 'g') return q
  if (baseUnit === 'g' && u === 'kg') return q * 1000
  if (baseUnit === 'ml' && u === 'ml') return q
  if (baseUnit === 'ml' && u === 'l') return q * 1000

  throw Object.assign(
    new Error(`Unit "${unit}" is not compatible with this item's base unit "${baseUnit}"`),
    { code: 'CONSUMPTION_INCOMPATIBLE_UNIT' }
  )
}
