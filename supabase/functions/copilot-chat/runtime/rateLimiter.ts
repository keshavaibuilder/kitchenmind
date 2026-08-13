// Rate Limiter (§8.4) — per-household sliding-window turn rate limiter.
import { config } from '../config.ts'

interface WindowRecord {
  timestamps: number[]
}

export class HouseholdRateLimiter {
  #windows = new Map<string, WindowRecord>()

  /** Check whether a household has exceeded turn rate limits. Returns true if rate limited. */
  isRateLimited(householdId: string): boolean {
    const limit = config.rateLimitMaxTurnsPerMin
    if (limit <= 0) return false

    const now = Date.now()
    const windowMs = 60000 // 1 minute
    const record = this.#windows.get(householdId) ?? { timestamps: [] }

    // Prune entries older than 1 minute
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs)

    if (record.timestamps.length >= limit) {
      return true
    }

    record.timestamps.push(now)
    this.#windows.set(householdId, record)
    return false
  }

  /** Reset rate limits for testing */
  reset() {
    this.#windows.clear()
  }
}

export const rateLimiter = new HouseholdRateLimiter()
