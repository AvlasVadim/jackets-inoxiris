/**
 * In-memory anti-spam for POST /api/order (no database).
 * Shared by the Vite middleware path. Vercel `api/order.mjs` mirrors the same rules
 * in plain ESM (no TS imports on the serverless edge).
 *
 * Rate-limit Map is per process / serverless instance — fine for Hobby;
 * not a perfect cluster-wide limit across cold starts or multiple instances.
 */

export const HONEYPOT_FIELDS = ['website', 'company'] as const

export const ORDER_RATE_LIMIT_MAX = 5
export const ORDER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

export const ORDER_RATE_LIMIT_MESSAGE =
  'Слишком много заявок с вашего адреса. Подождите около 10 минут и попробуйте снова.'

type HitBucket = number[]

const hitsByIp = new Map<string, HitBucket>()

export function isHoneypotFilled(body: Record<string, unknown> | null | undefined): boolean {
  if (!body || typeof body !== 'object') return false
  for (const key of HONEYPOT_FIELDS) {
    const value = body[key]
    if (typeof value === 'string' && value.trim() !== '') return true
    if (typeof value === 'number' && Number.isFinite(value)) return true
    if (typeof value === 'boolean' && value) return true
  }
  return false
}

export function clientIpFromHeaders(
  headers: {
    [key: string]: string | string[] | undefined
  },
  fallback = 'unknown',
): string {
  const xff = headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0]?.trim() || fallback
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).split(',')[0]?.trim() || fallback
  }

  const real = headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  if (Array.isArray(real) && real[0]) return String(real[0]).trim() || fallback

  return fallback
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number }

/** Sliding window: max N hits per WINDOW_MS per IP key. */
export function checkOrderRateLimit(ip: string): RateLimitResult {
  const key = (ip || 'unknown').trim() || 'unknown'
  const now = Date.now()
  const cutoff = now - ORDER_RATE_LIMIT_WINDOW_MS

  let hits = hitsByIp.get(key) || []
  hits = hits.filter((t) => t > cutoff)

  if (hits.length >= ORDER_RATE_LIMIT_MAX) {
    hitsByIp.set(key, hits)
    const oldest = hits[0] ?? now
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + ORDER_RATE_LIMIT_WINDOW_MS - now) / 1000),
    )
    return { ok: false, retryAfterSec }
  }

  hits.push(now)
  hitsByIp.set(key, hits)

  // Bound memory on long-lived local Vite processes.
  if (hitsByIp.size > 2000) {
    for (const [k, bucket] of hitsByIp) {
      const kept = bucket.filter((t) => t > cutoff)
      if (kept.length === 0) hitsByIp.delete(k)
      else hitsByIp.set(k, kept)
    }
  }

  return { ok: true }
}
