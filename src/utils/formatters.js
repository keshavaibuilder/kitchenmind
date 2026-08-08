/**
 * Utility Formatters
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Formats a date string into relative time (e.g. "Updated today", "Updated 2 days ago")
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export function formatRelativeTime(dateVal) {
  if (!dateVal) return ''
  const timestamp = new Date(dateVal).getTime()
  if (isNaN(timestamp)) return ''
  const days = Math.floor((Date.now() - timestamp) / 86_400_000)
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days} days ago`
}

/**
 * Formats monetary amounts to Indian Rupee standard format (e.g., "₹1,250.00")
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  const val = Number(amount) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val)
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Formats a gram quantity for display, switching to kg above 1000g.
 * @param {number} grams
 * @returns {string}
 */
export function formatGrams(grams) {
  const g = Number(grams) || 0
  if (g >= 1000) {
    const kg = g / 1000
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)}kg`
  }
  return `${Math.round(g)}g`
}
