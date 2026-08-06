/**
 * Utility Input Validators
 */

/**
 * Validates email syntax
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email.trim())
}

/**
 * Checks if a value is a valid positive number
 * @param {any} val 
 * @returns {boolean}
 */
export function isPositiveNumber(val) {
  const num = Number(val)
  return !isNaN(num) && num > 0
}

/**
 * Validates household name
 * @param {string} name 
 * @returns {boolean}
 */
export function isValidHouseholdName(name) {
  return typeof name === 'string' && name.trim().length >= 2
}
