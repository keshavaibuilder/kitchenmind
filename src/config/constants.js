/**
 * Application Constants
 * Standardized enumerations, categories, and thresholds.
 */

export const CATEGORIES = {
  STAPLES: 'Staples',
  FRESH_VEG: 'Fresh & Vegetables',
  NON_VEG: 'Non-Veg',
  DAIRY: 'Dairy',
  SPICES: 'Spices',
  MISCELLANEOUS: 'Miscellaneous',
}

export const CATEGORY_LIST = [
  CATEGORIES.STAPLES,
  CATEGORIES.FRESH_VEG,
  CATEGORIES.NON_VEG,
  CATEGORIES.DAIRY,
  CATEGORIES.SPICES,
  CATEGORIES.MISCELLANEOUS,
]

export const MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  TIFFIN: 'tiffin',
  SNACK: 'snack',
}

export const MEMBER_ROLES = {
  ADULT: 'adult',
  CHILD: 'child',
  ELDER: 'elder',
}

export const BILL_SOURCES = {
  SCAN: 'scan',
  MANUAL: 'manual',
}

export const MEAL_STATUS = {
  PLANNED: 'planned',
  COOKED: 'cooked',
  SKIPPED: 'skipped',
}

export const TIFFIN_DEFAULTS = {
  NONE: 'none',
  BOX_1: '1box',
  BOX_2: '2boxes',
  VARIES: 'varies',
}

export const DEFAULT_CONSUMPTION = {
  ROTI_PER_ADULT: 3,
  ROTI_PER_CHILD: 2,
  BASELINE_MEMBERS: 4,
}
