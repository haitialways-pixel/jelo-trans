/** Current format: PH + 6 unambiguous alphanumeric chars (8 total). */
export const BOOKING_NUMBER_RE = /^PH[A-Z2-9]{6}$/
export const BOOKING_NUMBER_FRAGMENT_RE = /PH[A-Z2-9]{6}/i

export function isBookingNumber(value: string): boolean {
  return BOOKING_NUMBER_RE.test(value.trim().toUpperCase())
}

export function normalizeBookingNumber(value: string): string {
  return value.trim().toUpperCase()
}

export function extractBookingNumber(text: string): string | null {
  return text.match(BOOKING_NUMBER_FRAGMENT_RE)?.[0]?.toUpperCase() ?? null
}