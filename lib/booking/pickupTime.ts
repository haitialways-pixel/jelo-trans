/** Minimum lead time before pickup (online bookings). */
export const MIN_PICKUP_LEAD_MS = 15 * 60 * 1000

/** Small grace for clock skew between browser and server. */
const VALIDATION_GRACE_MS = 2 * 60 * 1000

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Parse datetime-local (YYYY-MM-DDTHH:mm) as local wall-clock time.
 * Avoids browser inconsistencies where some engines treat the value as UTC.
 */
export function parsePickupTimeLocal(value: string): Date | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const m = trimmed.match(DATETIME_LOCAL_RE)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2]) - 1
    const day = Number(m[3])
    const hour = Number(m[4])
    const minute = Number(m[5])
    const d = new Date(year, month, day, hour, minute, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Convert datetime-local → UTC ISO.
 * MUST run in the customer's browser (uses local timezone).
 * Do not call from server actions — the server runs in UTC and will misread wall-clock times.
 */
export function pickupTimeToIso(value: string): string | null {
  const d = parsePickupTimeLocal(value)
  return d ? d.toISOString() : null
}

/**
 * Server-safe: convert datetime-local + browser timezone offset to UTC ISO.
 * `offsetMinutes` = `new Date().getTimezoneOffset()` from the client.
 */
export function pickupLocalToIsoWithOffset(
  value: string,
  offsetMinutes: number,
): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const m = trimmed.match(DATETIME_LOCAL_RE)
  if (!m) return null

  const utcMs =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) +
    offsetMinutes * 60_000

  const d = new Date(utcMs)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function minPickupDate(): Date {
  return new Date(Date.now() + MIN_PICKUP_LEAD_MS - VALIDATION_GRACE_MS)
}

/** Client-only — uses local timezone via parsePickupTimeLocal. */
export function isPickupTimeValid(value: string): boolean {
  const d = parsePickupTimeLocal(value)
  if (!d) return false
  return d.getTime() >= minPickupDate().getTime()
}

/** Server-safe — validates an already-converted UTC ISO string. */
export function isPickupIsoValid(iso: string): boolean {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return false
  return ms >= Date.now() + MIN_PICKUP_LEAD_MS - VALIDATION_GRACE_MS
}

/** For datetime-local `min` attribute (local timezone). */
export function minPickupDatetimeLocalValue(): string {
  const d = new Date(Date.now() + MIN_PICKUP_LEAD_MS - VALIDATION_GRACE_MS)
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export function pickupTimeValidationMessage(): string {
  return 'Pickup must be at least 15 minutes from now'
}