/** Minimum lead time before pickup (online bookings). */
export const MIN_PICKUP_LEAD_MS = 15 * 60 * 1000

/** Parse datetime-local value (YYYY-MM-DDTHH:mm) as local wall-clock time. */
export function parsePickupTimeLocal(value: string): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

/** Send pickup to Supabase as UTC ISO (avoids timezone skew on the server). */
export function pickupTimeToIso(value: string): string | null {
  const d = parsePickupTimeLocal(value)
  return d ? d.toISOString() : null
}

export function minPickupDate(): Date {
  return new Date(Date.now() + MIN_PICKUP_LEAD_MS)
}

export function isPickupTimeValid(value: string): boolean {
  const d = parsePickupTimeLocal(value)
  if (!d) return false
  return d.getTime() >= minPickupDate().getTime()
}

/** For datetime-local `min` attribute (local timezone). */
export function minPickupDatetimeLocalValue(): string {
  const d = minPickupDate()
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}