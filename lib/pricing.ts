/** Gratuity options shown at checkout (% of trip fare, before gratuity). */
export const GRATUITY_OPTIONS = [15, 18, 22] as const
export type GratuityPercent = (typeof GRATUITY_OPTIONS)[number]

export const DEFAULT_GRATUITY_PERCENT: GratuityPercent = 18

export type TripType = 'one_way' | 'round_trip' | 'charter'

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  one_way: 'One-way',
  round_trip: 'Round trip',
  charter: 'Charter (hourly)',
}

/** Minimum billable hours for hourly charter. */
export const CHARTER_MIN_HOURS = 3

export const CHARTER_HOUR_OPTIONS = [3, 4, 5, 6, 8, 10, 12] as const

export function isValidGratuityPercent(value: number): value is GratuityPercent {
  return (GRATUITY_OPTIONS as readonly number[]).includes(value)
}

export function isValidTripType(value: unknown): value is TripType {
  return value === 'one_way' || value === 'round_trip' || value === 'charter'
}

export function normalizeTripType(value: unknown): TripType {
  return isValidTripType(value) ? value : 'one_way'
}

export function normalizeCharterHours(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return CHARTER_MIN_HOURS
  // Snap to 0.25h blocks, enforce minimum
  const rounded = Math.round(n * 4) / 4
  return Math.max(rounded, CHARTER_MIN_HOURS)
}

/**
 * Server-authoritative trip pricing.
 *
 * - one_way:     base + miles × per-mile (floor at minimum)
 * - round_trip:  base + (miles × 2) × per-mile (floor at minimum)
 * - charter:     hours × base (base is treated as the hourly rate); min hours apply
 */
export function computeTripPrice(input: {
  basePrice: number
  pricePerMile: number
  distanceMiles: number
  minimumPrice?: number
  gratuityPercent: number
  tripType?: TripType
  charterHours?: number
}) {
  const tripType = normalizeTripType(input.tripType)
  const charterHours =
    tripType === 'charter' ? normalizeCharterHours(input.charterHours) : null

  const oneWayMiles = Math.max(Number(input.distanceMiles || 0), 0)
  const billableMiles =
    tripType === 'round_trip' ? oneWayMiles * 2 : tripType === 'one_way' ? oneWayMiles : 0

  let fareSubtotal: number
  if (tripType === 'charter') {
    fareSubtotal = Math.round((charterHours! * input.basePrice) * 100) / 100
  } else {
    fareSubtotal = Math.max(
      Math.round((input.basePrice + billableMiles * input.pricePerMile) * 100) / 100,
      Number(input.minimumPrice ?? 0),
    )
  }

  const gratuityAmount =
    Math.round(((fareSubtotal * input.gratuityPercent) / 100) * 100) / 100
  const total = Math.round((fareSubtotal + gratuityAmount) * 100) / 100

  return {
    fareSubtotal,
    gratuityPercent: input.gratuityPercent,
    gratuityAmount,
    total,
    tripType,
    charterHours,
    billableMiles,
    oneWayMiles,
    hourlyRate: tripType === 'charter' ? input.basePrice : null,
  }
}
