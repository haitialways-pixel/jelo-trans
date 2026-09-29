import type { BookableVehicle, Vehicle } from '@/lib/fleet'
import { HOURLY_SEDAN, HOURLY_SUV } from '@/lib/site'
import type { VehicleRateClass } from '@/lib/flatRates'

export type PublicClass = 'suv' | 'tesla' | 'sedan'

export const PUBLIC_CLASS_ORDER: PublicClass[] = ['suv', 'tesla', 'sedan']

export const PUBLIC_CLASS_LABELS: Record<PublicClass, string> = {
  suv: 'Full-size SUVs',
  tesla: 'Tesla',
  sedan: 'Sedan',
}

const HIDDEN =
  /(sprinter|stretch|party\s*bus|limo van|executive stretch)/i

const BANNED_IMAGE_FRAGMENTS = [
  'luxury-sedan.png',
  'sprinter.png',
  'suburban-driver',
]

const CLASS_FALLBACK: Record<PublicClass, string> = {
  suv: '/images/fleet-suv.webp',
  tesla: '/images/fleet-wash.webp',
  sedan: '/images/fleet-sedan.webp',
}

export function isHiddenVehicle(name: string, type?: string | null): boolean {
  return HIDDEN.test(`${name} ${type ?? ''}`)
}

export function classifyVehicle(name: string, type?: string | null): PublicClass | 'hidden' {
  const s = `${name} ${type ?? ''}`.toLowerCase()
  if (HIDDEN.test(s)) return 'hidden'
  if (/tesla|model y/.test(s)) return 'tesla'
  if (
    /(sedan|s-class|s class|lincoln|continental|e-class|c-class)/.test(s) &&
    !/(suv|suburban|yukon|expedition|escalade|tahoe)/.test(s)
  ) {
    return 'sedan'
  }
  return 'suv'
}

export function rateClassFor(name: string, type?: string | null): VehicleRateClass {
  const cls = classifyVehicle(name, type)
  return cls === 'suv' ? 'suv' : 'sedan'
}

export function publishedHourly(name: string, type?: string | null): number {
  return rateClassFor(name, type) === 'suv' ? HOURLY_SUV : HOURLY_SEDAN
}

export function sanitizeImageUrl(
  url: string | null | undefined,
  name: string,
  type?: string | null,
): string {
  const cls = classifyVehicle(name, type)
  const fallback = cls === 'hidden' ? CLASS_FALLBACK.suv : CLASS_FALLBACK[cls]
  if (!url) return fallback
  const lower = url.toLowerCase()
  if (BANNED_IMAGE_FRAGMENTS.some((frag) => lower.includes(frag))) return fallback
  return url
}

export function isPublicVehicle(v: { name: string; type?: string | null }): boolean {
  return classifyVehicle(v.name, v.type) !== 'hidden'
}

export function filterPublicFleet<T extends { name: string; type?: string | null }>(items: T[]): T[] {
  return items.filter(isPublicVehicle)
}

export function groupPublicFleet<T extends { name: string; type?: string | null }>(
  items: T[],
): { cls: PublicClass; label: string; items: T[] }[] {
  const publicItems = filterPublicFleet(items)
  return PUBLIC_CLASS_ORDER.map((cls) => ({
    cls,
    label: PUBLIC_CLASS_LABELS[cls],
    items: publicItems.filter((v) => classifyVehicle(v.name, v.type) === cls),
  })).filter((g) => g.items.length > 0)
}

export const COMPANY_SUV: Vehicle = {
  id: 'company-fullsize-suv',
  name: 'Full-Size SUV',
  type: 'luxury_suv',
  capacity: 6,
  luggage_capacity: 6,
  base_price: 0,
  price_per_mile: 0,
  hourly_rate: HOURLY_SUV,
  image_url: '/images/fleet-suv.webp',
  description:
    'Chevrolet Suburban, GMC Yukon XL SLT, and 2024 Ford Expedition MAX Limited. Twelve company SUVs, model years 2021–2024. $110/hour with a 3-hour minimum.',
  featured: true,
  display_order: 10,
  tier: 'suv',
}

export const COMPANY_TESLA: Vehicle = {
  id: 'company-tesla-model-y',
  name: '2023 Tesla Model Y',
  type: 'tesla',
  capacity: 4,
  luggage_capacity: 3,
  base_price: 0,
  price_per_mile: 0,
  hourly_rate: HOURLY_SEDAN,
  image_url: '/images/fleet-wash.webp',
  description: 'Company 2023 Tesla Model Y for executive transfers and hourly charter.',
  featured: true,
  display_order: 50,
  tier: 'tesla',
}

/** Partner sedan shown when the live catalog has no sedan row. */
export const PARTNER_SEDAN: Vehicle = {
  id: 'partner-luxury-sedan',
  name: 'Luxury Sedan',
  type: 'luxury_sedan',
  capacity: 3,
  luggage_capacity: 2,
  base_price: 0,
  price_per_mile: 0,
  hourly_rate: HOURLY_SEDAN,
  image_url: '/images/fleet-sedan.webp',
  description:
    'Mercedes-Benz S-Class and similar luxury sedans, provided through contracted chauffeur partners. $100/hour with a 3-hour minimum.',
  featured: true,
  display_order: 90,
  tier: 'sedan',
}

export function withPublicCatalog(fleet: Vehicle[]): Vehicle[] {
  const next = [...fleet]
  if (!next.some((v) => classifyVehicle(v.name, v.type) === 'suv')) next.push(COMPANY_SUV)
  if (!next.some((v) => classifyVehicle(v.name, v.type) === 'tesla')) next.push(COMPANY_TESLA)
  if (!next.some((v) => classifyVehicle(v.name, v.type) === 'sedan')) next.push(PARTNER_SEDAN)
  return next
}

export function decorateVehicle(v: Vehicle): Vehicle {
  return {
    ...v,
    image_url: sanitizeImageUrl(v.image_url, v.name, v.type),
  }
}

export function decorateBookable(v: BookableVehicle & { type?: string | null }): BookableVehicle & {
  type: string
} {
  return {
    ...v,
    type: v.type ?? '',
    image_url: sanitizeImageUrl(v.image_url, v.name, v.type),
  }
}
