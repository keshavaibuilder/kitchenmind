/**
 * Standard Application Error
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human readable error message
   * @param {string} [code='UNKNOWN_ERROR'] - Error category or code
   * @param {number|null} [status=null] - Status code if applicable
   * @param {any} [originalError=null] - Upstream error details
   */
  constructor(message, code = 'UNKNOWN_ERROR', status = null, originalError = null) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.originalError = originalError
  }
}

/**
 * Normalizes any error into a standard AppError
 * @param {any} err 
 * @param {string} [defaultCode='UNKNOWN_ERROR'] 
 * @returns {AppError}
 */
export function normalizeError(err, defaultCode = 'UNKNOWN_ERROR') {
  if (err instanceof AppError) {
    return err
  }

  if (err && typeof err === 'object') {
    const message = err.message || err.error_description || err.details || 'An unexpected error occurred.'
    const status = err.status || err.statusCode || null
    const code = err.code || defaultCode
    return new AppError(message, code, status, err)
  }

  if (typeof err === 'string') {
    return new AppError(err, defaultCode)
  }

  return new AppError('An unexpected error occurred.', defaultCode, null, err)
}
