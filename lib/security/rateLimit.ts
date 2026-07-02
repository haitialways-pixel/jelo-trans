// Rate limiting wrapper — SERVER ONLY.
//
// Calls the DB-side check_rate_limit() under the service_role client (so anon
// users can NEVER bypass or poison the table). Fails OPEN if the rate-limit
// infrastructure itself is unreachable, on the principle that a flaky limiter
// should never bring down the booking flow — it logs and lets the request
// through so the user isn't blocked by something unrelated to their action.
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

const LOCAL_FALLBACK_IP = 'local-or-unknown'

/** Extract the client IP from edge headers. Works on Vercel; localhost-safe. */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? LOCAL_FALLBACK_IP
}

/** Variant for API routes that receive a Request object directly. */
export function getClientIpFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? LOCAL_FALLBACK_IP
}

/**
 * Returns {ok: true} when the action is allowed, {ok: false, retryAfter} when it
 * is denied. `windowSec` is the size of the sliding window; `max` is the cap
 * inside that window per IP+action.
 */
export async function checkRateLimit(
  action: string,
  max: number,
  windowSec: number,
  ip?: string,
  /** When false, checks the cap without logging an attempt (use before an action; record on success). */
  record = true,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'development') {
    return { ok: true }
  }

  const clientIp = ip ?? (await getClientIp())
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_ip: clientIp,
      p_action: action,
      p_max: max,
      p_window_seconds: windowSec,
      p_record: record,
    })
    if (error) {
      // Limiter infra failing -> fail open. Log so we can spot it in monitoring.
      console.error('[rateLimit] RPC error, failing open:', error.message)
      return { ok: true }
    }
    if (data === true) return { ok: true }
    return { ok: false, retryAfter: windowSec }
  } catch (e) {
    console.error('[rateLimit] thrown, failing open:', e instanceof Error ? e.message : e)
    return { ok: true }
  }
}

/** Convenience: returns a NextResponse-compatible 429 body when denied. */
export function rateLimitJson(retryAfter: number): { body: { error: string }; init: ResponseInit } {
  return {
    body: { error: 'Too many requests. Please slow down and try again shortly.' },
    init: {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  }
}
