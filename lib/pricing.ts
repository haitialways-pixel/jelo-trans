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
 * Resolve charter $/hr from fleet.
 * Prefer explicit hourly_rate; fall back to base_price only if hourly is missing/0
 * (pre-migration rows).
 */
export function resolveHourlyRate(input: {
  hourlyRate?: number | null
  basePrice?: number | null
}): number {
  const hourly = Number(input.hourlyRate)
  if (Number.isFinite(hourly) && hourly > 0) return hourly
  const base = Number(input.basePrice)
  if (Number.isFinite(base) && base > 0) return base
  return 0
}

/**
 * Server-authoritative trip pricing.
 *
 * - one_way:     base + miles × per-mile (floor at minimum)
 * - round_trip:  base + (miles × 2) × per-mile (floor at minimum)
 * - charter:     hours × hourly_rate (fleet.hourly_rate); min hours apply
 */
export function computeTripPrice(input: {
  basePrice: number
  pricePerMile: number
  distanceMiles: number
  minimumPrice?: number
  /** Charter rate from fleet.hourly_rate */
  hourlyRate?: number | null
  gratuityPercent: number
  tripType?: TripType
  charterHours?: number
}) {
  const tripType = normalizeTripType(input.tripType)
  const charterHours =
    tripType === 'charter' ? normalizeCharterHours(input.charterHours) : null
  const hourlyRate = resolveHourlyRate({
    hourlyRate: input.hourlyRate,
    basePrice: input.basePrice,
  })

  const oneWayMiles = Math.max(Number(input.distanceMiles || 0), 0)
  const billableMiles =
    tripType === 'round_trip' ? oneWayMiles * 2 : tripType === 'one_way' ? oneWayMiles : 0

  let fareSubtotal: number
  if (tripType === 'charter') {
    fareSubtotal = Math.round((charterHours! * hourlyRate) * 100) / 100
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
    hourlyRate: tripType === 'charter' ? hourlyRate : null,
  }
}
