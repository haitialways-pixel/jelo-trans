/** Gratuity options shown at checkout (% of trip fare, before gratuity). */
export const GRATUITY_OPTIONS = [15, 18, 22] as const
export type GratuityPercent = (typeof GRATUITY_OPTIONS)[number]

export const DEFAULT_GRATUITY_PERCENT: GratuityPercent = 18

export function isValidGratuityPercent(value: number): value is GratuityPercent {
  return (GRATUITY_OPTIONS as readonly number[]).includes(value)
}

export function computeTripPrice(input: {
  basePrice: number
  pricePerMile: number
  distanceMiles: number
  minimumPrice?: number
  gratuityPercent: number
}) {
  const fareSubtotal = Math.max(
    Math.round((input.basePrice + input.distanceMiles * input.pricePerMile) * 100) / 100,
    Number(input.minimumPrice ?? 0),
  )
  const gratuityAmount =
    Math.round(((fareSubtotal * input.gratuityPercent) / 100) * 100) / 100
  const total = Math.round((fareSubtotal + gratuityAmount) * 100) / 100

  return {
    fareSubtotal,
    gratuityPercent: input.gratuityPercent,
    gratuityAmount,
    total,
  }
}