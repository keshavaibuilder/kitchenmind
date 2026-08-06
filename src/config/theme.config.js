/**
 * Theme & Style Tokens
 * Centralized color palette and visual tokens for KitchenMind.
 */

export const THEME_COLORS = {
  NAVY: '#1E3A5F',     // Primary dark text / brand accent
  TEAL: '#2E86AB',     // Primary interactive brand color
  SURFACE: '#F5F7FA',  // Application container background
}

export const CATEGORY_THEMES = {
  'Staples': {
    chip: 'bg-blue-100 text-[#2E86AB]',
    border: 'border-l-[#2E86AB]',
  },
  'Fresh & Vegetables': {
    chip: 'bg-green-100 text-[#1A7A4A]',
    border: 'border-l-[#1A7A4A]',
  },
  'Non-Veg': {
    chip: 'bg-red-100 text-[#C0392B]',
    border: 'border-l-[#C0392B]',
  },
  'Dairy': {
    chip: 'bg-yellow-100 text-[#D4AC0D]',
    border: 'border-l-[#D4AC0D]',
  },
  'Spices': {
    chip: 'bg-orange-100 text-[#E67E22]',
    border: 'border-l-[#E67E22]',
  },
  'Miscellaneous': {
    chip: 'bg-purple-100 text-[#8E44AD]',
    border: 'border-l-[#8E44AD]',
  },
}
