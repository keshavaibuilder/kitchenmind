/**
 * Roti flour requirement calculation.
 *
 * Built against the actual committed schema (0001_initial_schema.sql), not the age-tiered
 * formula in docs/09 — the `members` table has no `age` column, only `role`
 * ('adult'|'child'|'elder') and an optional per-member `roti_preference` override, and
 * household-level defaults live on `household.roti_per_adult` / `household.roti_per_child`.
 * Elder falls back to the adult default; there is no dedicated elder rate in the schema.
 */

const DEFAULT_FLOUR_PER_ROTI_GRAMS = 28.5
const DOUGH_HYDRATION_MULTIPLIER = 1.65 // ~65% water ratio -> total dough weight including flour

export function calculateMemberRotiCount(member, household) {
  if (member.roti_preference !== undefined && member.roti_preference !== null) {
    return Number(member.roti_preference)
  }
  if (member.role === 'child') return household.roti_per_child ?? 2
  return household.roti_per_adult ?? 3
}

/**
 * Sums the `guests` table's `count` for a given date, matching entries whose meal_scope is
 * either the specific meal or 'all'.
 */
export function getEffectiveGuestCount(guests = [], date, mealType) {
  return guests
    .filter((g) => g.date === date && (g.meal_scope === mealType || g.meal_scope === 'all'))
    .reduce((sum, g) => sum + (Number(g.count) || 0), 0)
}

/**
 * @param {Object} params
 * @param {Array<{role: string, roti_preference?: number}>} params.members
 * @param {{roti_per_adult?: number, roti_per_child?: number}} params.household
 * @param {number} [params.guestCount=0]
 * @param {number} [params.andaazaFactor=1.0] - Household historical multiplier (default until
 *   AndaazaLearningService's volumetric calibration is implemented — see docs/07 §2).
 * @param {number} [params.flourPerRotiGrams=28.5]
 * @returns {{ totalRotis: number, totalFlourGrams: number, estimatedDoughGrams: number }}
 */
export function calculateRotiRequirement({
  members = [],
  household = {},
  guestCount = 0,
  andaazaFactor = 1.0,
  flourPerRotiGrams = DEFAULT_FLOUR_PER_ROTI_GRAMS,
}) {
  const memberRotis = members.reduce((sum, m) => sum + calculateMemberRotiCount(m, household), 0)
  const guestRotis = guestCount * (household.roti_per_adult ?? 3)
  const totalRotis = memberRotis + guestRotis

  const totalFlourGrams = Math.ceil(totalRotis * flourPerRotiGrams * andaazaFactor)
  const estimatedDoughGrams = Math.ceil(totalFlourGrams * DOUGH_HYDRATION_MULTIPLIER)

  return {
    totalRotis: Math.round(totalRotis * 10) / 10,
    totalFlourGrams,
    estimatedDoughGrams,
  }
}
