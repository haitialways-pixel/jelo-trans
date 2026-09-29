/**
 * Named-place flat rates for MCO transfers.
 * Mileage calculator remains the default for every other trip.
 */

export type VehicleRateClass = 'sedan' | 'suv'

export type FlatDestination = {
  id: string
  label: string
  sedan: number
  suv: number
  /** Lowercased needles matched against Google-formatted or typed addresses. */
  needles: string[]
}

const MCO_NEEDLES = [
  'orlando international',
  'orlando intl',
  'mco airport',
  'airport mco',
  'mco,',
  'mco ',
  '(mco)',
  '1 jeff fuqua',
  'jeff fuqua boulevard',
  'jeff fuqua blvd',
]

export const FLAT_DESTINATIONS: FlatDestination[] = [
  {
    id: 'universal',
    label: 'Universal Orlando',
    sedan: 80,
    suv: 95,
    needles: ['universal orlando', 'universal studios', 'islands of adventure', 'universal citywalk', 'citywalk'],
  },
  {
    id: 'camping-world',
    label: 'Camping World Stadium',
    sedan: 80,
    suv: 95,
    needles: ['camping world stadium', 'camping world'],
  },
  {
    id: 'icon-park',
    label: 'ICON Park',
    sedan: 80,
    suv: 95,
    needles: ['icon park', 'the wheel at icon', 'i-drive 360'],
  },
  {
    id: 'seaworld',
    label: 'SeaWorld',
    sedan: 70,
    suv: 85,
    needles: ['seaworld', 'sea world'],
  },
  {
    id: 'epcot',
    label: 'EPCOT',
    sedan: 100,
    suv: 120,
    needles: ['epcot'],
  },
  {
    id: 'hollywood-studios',
    label: 'Hollywood Studios',
    sedan: 100,
    suv: 120,
    needles: ['hollywood studios'],
  },
  {
    id: 'disney-springs',
    label: 'Disney Springs',
    sedan: 100,
    suv: 120,
    needles: ['disney springs'],
  },
  {
    id: 'magic-kingdom',
    label: 'Magic Kingdom',
    sedan: 110,
    suv: 130,
    needles: ['magic kingdom'],
  },
  {
    id: 'animal-kingdom',
    label: 'Animal Kingdom',
    sedan: 110,
    suv: 130,
    needles: ['animal kingdom'],
  },
  {
    id: 'pointe-orlando',
    label: 'Pointe Orlando',
    sedan: 110,
    suv: 135,
    needles: ['pointe orlando'],
  },
  {
    id: 'medieval-times',
    label: 'Medieval Times',
    sedan: 200,
    suv: 250,
    needles: ['medieval times'],
  },
  {
    id: 'kennedy-space',
    label: 'Kennedy Space Center',
    sedan: 200,
    suv: 250,
    needles: ['kennedy space', 'ksc visitor', 'space center visitor'],
  },
  {
    id: 'port-canaveral',
    label: 'Port Canaveral',
    sedan: 200,
    suv: 250,
    needles: ['port canaveral', 'canaveral cruise', 'cruise terminal a', 'cruise terminal b', 'cruise terminal 1', 'cruise terminal 2', 'cruise terminal 3', 'cruise terminal 5', 'cruise terminal 6', 'cruise terminal 8'],
  },
  {
    id: 'legoland',
    label: 'Legoland',
    sedan: 300,
    suv: 375,
    needles: ['legoland'],
  },
  {
    id: 'gatorland',
    label: 'Gatorland',
    sedan: 50,
    suv: 65,
    needles: ['gatorland'],
  },
]

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function containsNeedle(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n))
}

export function isMcoAddress(address: string): boolean {
  const n = norm(address)
  if (!n) return false
  if (/\bmco\b/.test(n)) return true
  return containsNeedle(n, MCO_NEEDLES)
}

export function matchNamedPlace(address: string): FlatDestination | null {
  const n = norm(address)
  if (!n) return null
  // Longer needles first so "universal orlando" wins over a shorter clash.
  let best: FlatDestination | null = null
  let bestLen = 0
  for (const dest of FLAT_DESTINATIONS) {
    for (const needle of dest.needles) {
      if (n.includes(needle) && needle.length > bestLen) {
        best = dest
        bestLen = needle.length
      }
    }
  }
  return best
}

export type FlatMatch = {
  destination: FlatDestination
  sedan: number
  suv: number
  rate: number
  label: string
}

/**
 * A transfer is a flat-rate trip only when one end is MCO and the other is a
 * named place in the table. Either direction. Returns null for everything else
 * (including hourly charters, which the caller should skip).
 */
export function matchFlatRate(
  pickup: string,
  dropoff: string,
  rateClass: VehicleRateClass,
): FlatMatch | null {
  const a = pickup || ''
  const b = dropoff || ''
  const pickupMco = isMcoAddress(a)
  const dropoffMco = isMcoAddress(b)
  if (pickupMco === dropoffMco) return null

  const other = pickupMco ? b : a
  const dest = matchNamedPlace(other)
  if (!dest) return null

  const rate = rateClass === 'suv' ? dest.suv : dest.sedan
  return {
    destination: dest,
    sedan: dest.sedan,
    suv: dest.suv,
    rate,
    label: dest.label,
  }
}

export function flatFareForTrip(
  match: FlatMatch,
  tripType: 'one_way' | 'round_trip' | 'charter',
): number {
  if (tripType === 'round_trip') return match.rate * 2
  return match.rate
}
