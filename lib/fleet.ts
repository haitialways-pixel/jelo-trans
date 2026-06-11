import { createClient } from '@/lib/supabase/server'

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

const FLEET_COLUMNS =
  'id, name, type, capacity, luggage_capacity, base_price, price_per_mile, image_url, description, featured, display_order, tier'

/** All bookable vehicles, in the business-defined display order (then by price). */
export async function getFleet(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fleet')
    .select(FLEET_COLUMNS)
    .eq('status', 'available')
    .order('display_order', { ascending: true })
    .order('base_price', { ascending: true })

  if (error || !data) return []
  // Supabase returns numeric columns as strings; coerce price to a number here so
  // every consumer gets a real number.
  return data.map((v) => ({
    ...v,
    base_price: Number(v.base_price),
    price_per_mile: Number(v.price_per_mile),
  })) as Vehicle[]
}

/** A curated subset for teasers (home). Falls back to the first N if none flagged. */
export async function getFeaturedFleet(limit = 4): Promise<Vehicle[]> {
  const all = await getFleet()
  const featured = all.filter((v) => v.featured)
  return (featured.length > 0 ? featured : all).slice(0, limit)
}
