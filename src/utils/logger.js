/**
 * Centralized Client Logger
 */

const IS_DEV = import.meta.env.DEV

export const logger = {
  info: (...args) => {
    if (IS_DEV) console.log('[INFO]', ...args)
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args)
  },
  error: (...args) => {
    console.error('[ERROR]', ...args)
  },
}
