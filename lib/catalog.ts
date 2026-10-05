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
  /(sprinter|stretch|party\s*bus|limo van|executive stretch|escalade)/i

const BANNED_IMAGE_FRAGMENTS = [
  'luxury-sedan.png',
  'sprinter.png',
  'suburban-driver',
  'escalade',
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

/** Public pages only show rows that exist in the fleet table. No placeholder classes. */
export function withPublicCatalog(fleet: Vehicle[]): Vehicle[] {
  return filterPublicFleet(fleet)
}

/**
 * Public display only: drop model years from a vehicle/class name or description.
 * "2023 Tesla Model Y" → "Tesla Model Y". Does not change stored fleet rows.
 */
export function formatPublicVehicleName(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .replace(/\bmodel years?\s+(?:19|20)\d{2}(?:\s*[–-]\s*(?:19|20)\d{2})?\b/gi, '')
    .replace(/(^|\s)(?:19|20)\d{2}(?:\s*[–-]\s*(?:19|20)\d{2})?(?=\s|[.,;:!?)]|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/,\s+\(/g, ' (')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

export function decorateVehicle(v: Vehicle): Vehicle {
  return {
    ...v,
    name: formatPublicVehicleName(v.name),
    description: v.description ? formatPublicVehicleName(v.description) : v.description,
    image_url: sanitizeImageUrl(v.image_url, v.name, v.type),
  }
}

export function decorateBookable(v: BookableVehicle & { type?: string | null }): BookableVehicle & {
  type: string
} {
  return {
    ...v,
    type: v.type ?? '',
    name: formatPublicVehicleName(v.name),
    image_url: sanitizeImageUrl(v.image_url, v.name, v.type),
  }
}
