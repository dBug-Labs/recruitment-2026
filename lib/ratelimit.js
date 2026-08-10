/**
 * lib/ratelimit.js
 *
 * Rate limiting using an in-process Map.
 * Note: This does NOT survive process restarts and does NOT work across multiple instances.
 *
 * Usage:
 *   import { checkRateLimit } from '@/lib/ratelimit'
 *   const result = await checkRateLimit(ip, { limit: 5, windowSeconds: 3600 })
 *   if (!result.allowed) {
 *     return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
 *   }
 */

/**
 * @type {Map<string, { count: number, resetAt: number }>}
 */
const devStore = new Map()

/**
 * In-memory sliding window (approximate).
 * @param {string} identifier
 * @param {number} limit
 * @param {number} windowSeconds
 */
function checkInProcess(identifier, limit, windowSeconds) {
  const now     = Date.now()
  const key     = `rl:${identifier}`
  const entry   = devStore.get(key)
  const resetAt = entry && entry.resetAt > now ? entry.resetAt : now + windowSeconds * 1000
  const count   = entry && entry.resetAt > now ? entry.count + 1 : 1

  devStore.set(key, { count, resetAt })

  // Cleanup old keys periodically to avoid memory growth
  if (devStore.size > 10_000) {
    for (const [k, v] of devStore) {
      if (v.resetAt < now) devStore.delete(k)
    }
  }

  return {
    allowed:   count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt:   new Date(resetAt),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RateLimitOptions
 * @property {number} [limit=5]          — max requests allowed in the window
 * @property {number} [windowSeconds=3600] — rolling window duration in seconds
 *
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed    — true if the request should proceed
 * @property {number}  remaining  — requests remaining in the current window
 * @property {Date}    resetAt    — when the window resets
 */

/**
 * Checks whether the given identifier has exceeded the rate limit.
 *
 * @param {string} identifier — typically an IP address, but could be an email
 * @param {RateLimitOptions} [options]
 * @returns {Promise<RateLimitResult>}
 */
export async function checkRateLimit(identifier, options = {}) {
  const { limit = 5, windowSeconds = 3600 } = options
  return checkInProcess(identifier, limit, windowSeconds)
}

/**
 * Extracts the client IP from a Next.js Request object.
 * Returns 'unknown' if no IP header is found.
 *
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
