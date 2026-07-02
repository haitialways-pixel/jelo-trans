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
  image_url: string | null
  description: string | null
  featured: boolean
  display_order: number
  tier: string | null
}

export type BookableVehicle = Pick<
  Vehicle,
  'id' | 'name' | 'capacity' | 'base_price' | 'price_per_mile' | 'image_url'
>

const FLEET_COLUMNS =
  'id,name,type,capacity,luggage_capacity,base_price,price_per_mile,image_url,description,featured,display_order,tier'

const BOOKING_COLUMNS = 'id,name,capacity,base_price,price_per_mile,image_url'

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
  image_url: string | null
  description: string | null
  featured: boolean
  display_order: number
  tier: string | null
}

function normalizeVehicle(row: FleetRow): Vehicle {
  return {
    ...row,
    base_price: Number(row.base_price),
    price_per_mile: Number(row.price_per_mile),
  }
}

async function fetchFleetRows(
  select: string,
  searchParams: Record<string, string>,
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
    next: { revalidate: FLEET_REVALIDATE_SECONDS, tags: ['fleet'] },
  })

  if (!response.ok) return []

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

/** Slim fleet payload for the booking wizard. */
export const getBookableFleet = cache(async (): Promise<BookableVehicle[]> => {
  const rows = await fetchFleetRows(BOOKING_COLUMNS, {
    order: 'base_price.asc',
  })
  return rows.map(({ id, name, capacity, base_price, price_per_mile, image_url }) => ({
    id,
    name,
    capacity,
    base_price,
    price_per_mile,
    image_url,
  }))
})