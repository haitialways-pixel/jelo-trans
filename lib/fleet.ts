import { cache } from 'react'

// Single source of truth for fleet data. Every page (home, fleet, services, booking)
// derives from these — no hardcoded vehicle lists anywhere.
export type Vehicle = {
  id: string
  name: string
  type: string
  capacity: number
  luggage_capacity: number
  base_price: number
  price_per_mile: number
  /** Charter / as-directed rate ($/hr). */
  hourly_rate: number
  image_url: string | null
  description: string | null
  featured: boolean
  display_order: number
  tier: string | null
}

export type BookableVehicle = Pick<
  Vehicle,
  'id' | 'name' | 'capacity' | 'base_price' | 'price_per_mile' | 'hourly_rate' | 'image_url'
>

const FLEET_COLUMNS =
  'id,name,type,capacity,luggage_capacity,base_price,price_per_mile,hourly_rate,image_url,description,featured,display_order,tier'

const BOOKING_COLUMNS = 'id,name,capacity,base_price,price_per_mile,hourly_rate,image_url'

/** Revalidate fleet catalog every 5 minutes — prices/status change infrequently. */
const FLEET_REVALIDATE_SECONDS = 300

type FleetRow = {
  id: string
  name: string
  type: string
  capacity: number
  luggage_capacity: number
  base_price: string | number
  price_per_mile: string | number
  hourly_rate?: string | number | null
  image_url: string | null
  description: string | null
  featured: boolean
  display_order: number
  tier: string | null
}

function normalizeVehicle(row: FleetRow): Vehicle {
  const base = Number(row.base_price)
  const hourlyRaw = Number(row.hourly_rate)
  return {
    ...row,
    base_price: base,
    price_per_mile: Number(row.price_per_mile),
    // Fallback to base until migration is applied / rate is set
    hourly_rate: Number.isFinite(hourlyRaw) && hourlyRaw > 0 ? hourlyRaw : base,
  }
}

async function fetchFleetRows(
  select: string,
  searchParams: Record<string, string>,
  options?: { fresh?: boolean },
): Promise<Vehicle[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!baseUrl || !anonKey) return []

  const params = new URLSearchParams({
    select,
    status: 'eq.available',
    ...searchParams,
  })

  const response = await fetch(`${baseUrl}/rest/v1/fleet?${params}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    ...(options?.fresh
      ? { cache: 'no-store' as const }
      : { next: { revalidate: FLEET_REVALIDATE_SECONDS, tags: ['fleet'] } }),
  })

  if (!response.ok) {
    // Pre-migration DBs may not have hourly_rate yet — retry without it.
    if (select.includes('hourly_rate')) {
      const fallback = select
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c !== 'hourly_rate')
        .join(',')
      return fetchFleetRows(fallback, searchParams, options)
    }
    return []
  }

  const rows = (await response.json()) as FleetRow[]
  return rows.map(normalizeVehicle)
}

/** All bookable vehicles, in the business-defined display order (then by price). */
export const getFleet = cache(async (): Promise<Vehicle[]> => {
  return fetchFleetRows(FLEET_COLUMNS, {
    order: 'display_order.asc,base_price.asc',
  })
})

/** A curated subset for teasers (home). Falls back to the first N if none flagged. */
export const getFeaturedFleet = cache(async (limit = 4): Promise<Vehicle[]> => {
  const featured = await fetchFleetRows(FLEET_COLUMNS, {
    featured: 'eq.true',
    order: 'display_order.asc,base_price.asc',
    limit: String(limit),
  })

  if (featured.length > 0) return featured

  return fetchFleetRows(FLEET_COLUMNS, {
    order: 'display_order.asc,base_price.asc',
    limit: String(limit),
  })
})

/** Slim fleet payload for the booking wizard (cached — marketing pages). */
export const getBookableFleet = cache(async (): Promise<BookableVehicle[]> => {
  const rows = await fetchFleetRows(BOOKING_COLUMNS, {
    order: 'base_price.asc',
  })
  return rows.map(({ id, name, capacity, base_price, price_per_mile, hourly_rate, image_url }) => ({
    id,
    name,
    capacity,
    base_price,
    price_per_mile,
    hourly_rate,
    image_url,
  }))
})

/** Always-fresh fleet for /book — avoids stale vehicle IDs after DB reseeds or manager edits. */
export async function getBookableFleetForBooking(): Promise<BookableVehicle[]> {
  const rows = await fetchFleetRows(
    BOOKING_COLUMNS,
    { order: 'base_price.asc' },
    { fresh: true },
  )
  return rows.map(({ id, name, capacity, base_price, price_per_mile, hourly_rate, image_url }) => ({
    id,
    name,
    capacity,
    base_price,
    price_per_mile,
    hourly_rate,
    image_url,
  }))
}