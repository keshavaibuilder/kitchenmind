// Andaaza — Indian kitchen quantity engine
// Converts between SI units and intuitive Indian kitchen expressions

export function normaliseToGrams(quantity_value, unit) {
  const v = parseFloat(quantity_value) || 0
  const u = (unit || '').toLowerCase().trim()

  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) return v
  if (['kg', 'kgs', 'kgm'].includes(u)) return v * 1000
  if (['ml', 'millilitre', 'milliliter'].includes(u)) return v
  if (['l', 'ltr', 'ltrs', 'litre', 'liter', 'litres', 'liters'].includes(u)) return v * 1000
  if (['pcs', 'pc', 'pieces', 'piece', 'nos', 'no', 'num', 'units'].includes(u)) return v
  return v // unknown unit: pass through
}

export function gramsToAndaaza(grams, category = '') {
  const cat = (category || '').toLowerCase()
  const g   = parseFloat(grams) || 0

  // ── Oil / Liquids ─────────────────────────────────────
  if (cat.includes('oil') || cat.includes('liquid') || cat === 'dairy') {
    if (g < 15)  return 'Thoda sa'
    if (g <= 35) return 'Ek kadchi'
    if (g <= 70) return 'Do kadchi'
    return `${Math.round(g)}ml`
  }

  // ── Spices ────────────────────────────────────────────
  if (cat.includes('spice') || cat.includes('masala') || cat.includes('mirch') || cat.includes('haldi')) {
    if (g < 1) return 'Cutki bhar'
    if (g <= 2) return 'Chutki'
    if (g <= 6) return 'Thoda sa'
    return 'Ek chammach'
  }

  // ── Dal / Rice / Flour / Vegetables (default) ─────────
  if (g < 60)  return 'Thoda sa'
  if (g <= 80) return 'Ek mutthi'
  if (g < 120) return 'Ek-ek aadha'         // gap between 80 and 120
  if (g <= 139) return 'Do mutthi'
  if (g <= 160) return 'Ek katori'           // ~1 standard cup
  if (g <= 220) return 'Teen mutthi'
  if (g <= 400) return 'Do katori'
  return 'Bahut saara'
}

export function parseExpression(raw) {
  // TODO: tokenise raw string into { quantity, unit, ingredient }
}

export async function resolveExpression(_expression, _ingredientId, _householdId) {
  // TODO: look up andaaza_profile for this ingredient+household, return grams
}

export async function calibrate(_ingredientId, _householdId, _observedGrams) {
  // TODO: update andaaza_profile with new observation, recalculate confidence
}
