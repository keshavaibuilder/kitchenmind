/**
 * Shared quantity-to-grams unit conversion. Single source of truth so
 * BillPersistenceService and AndaazaLearningEngine can't silently drift apart.
 */

// No per-ingredient weight table exists yet (an egg and a potato are not the same
// number of grams per piece) — this is a coarse average used only until Phase 4B+
// introduces ingredient-specific piece weights. Treating count units as 1g/piece
// (the previous behavior) was a straightforward data-corruption bug, not a placeholder.
const DEFAULT_GRAMS_PER_PIECE = 50

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
      return q * DEFAULT_GRAMS_PER_PIECE
    default:
      return q
  }
}
