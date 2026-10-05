/** Canonical public domain for booking/reservation links. */
export const SITE_DOMAIN = 'vipodyssey.com'

/** Bare brand website shown in invoices, receipts, and email footers. */
export const BRAND_WEBSITE = 'vipodyssey.com'

/** Absolute brand URL for email links. */
export const BRAND_URL = `https://${BRAND_WEBSITE}`

/** Public brand name used in subjects / footers. */
export const BRAND_NAME = 'Imperial Odyssey'

/** Legal entity — Route 7 Limo LLC doing business as Imperial Odyssey. */
export const LEGAL_NAME = 'Route 7 Limo LLC'
export const LEGAL_ENTITY = 'Route 7 Limo LLC, d/b/a Imperial Odyssey'
export const LEGAL_ENTITY_SHORT = 'Route 7 Limo LLC d/b/a Imperial Odyssey'

/** Legal payer name on 1099 contractor statements. */
export const PAYER_LEGAL_NAME = 'Route 7 Limo LLC'

/** Payer mailing address lines for 1099 print. */
export const PAYER_ADDRESS_LINES = ['Orlando, Florida'] as const

/** Default public contact phone (display form, no parens). */
export const BRAND_PHONE = '689-699-5849'

/** Phone with US parentheses for UI/chat copy. */
export const BRAND_PHONE_DISPLAY = '(689) 699-5849'

/** Click-to-call href. */
export const BRAND_PHONE_TEL = 'tel:+16896995849'

/** Default public contact email for company blocks on invoices/receipts. */
export const BRAND_EMAIL = 'info@vipodyssey.com'

/** SAM.gov / government contracting identifiers. */
export const SAM_UEI = 'XDCDBABZYA84'
export const SAM_CAGE = '24RN4'
export const SAM_NAICS = '485320'
export const SAM_NAICS_LABEL = 'Limousine Service'
export const SAM_LINE = `SAM.gov registered · UEI ${SAM_UEI} · CAGE ${SAM_CAGE}`

/** Published hourly charter rates (3-hour minimum). */
export const HOURLY_SUV = 110
export const HOURLY_SEDAN = 100

/** Deposit taken after staff confirmation — not at booking. */
export const DEPOSIT_PERCENT = 25
export const CANCEL_REFUND_HOURS = 24

export const PAYMENT_POLICY =
  "Submitting a reservation doesn't charge you anything. A staff member reviews every request and confirms it with you. Once your reservation is confirmed, we process a deposit of 25% of the fare. The deposit is fully refundable if you cancel at least 24 hours before your scheduled pickup time; cancellations within 24 hours are non-refundable."

export const FLEET_SUMMARY =
  '12 full-size SUVs (Chevrolet Suburban, GMC Yukon XL SLT, and Ford Expedition MAX Limited) plus a Tesla Model Y. Luxury sedans are available through contracted chauffeur partners.'

export const OG_IMAGE = '/images/hero-lineup.webp'

/** Customer-facing concierge / reply-to. */
export const BRAND_CONCIERGE_EMAIL = 'concierge@vipodyssey.com'

/** Booking / customer From address (must be verified in Resend). */
export const BRAND_BOOKINGS_EMAIL = 'bookings@vipodyssey.com'

/** Dispatch / no-reply From address (must be verified in Resend). */
export const BRAND_NOREPLY_EMAIL = 'no-reply@vipodyssey.com'

/** Retired domains that must never appear on customer-facing documents. */
const LEGACY_BRAND_HOSTS = [
  'phalotrans.com',
  'www.phalotrans.com',
  'phalotransportation.com',
  'www.phalotransportation.com',
] as const

const LEGACY_EMAIL_DOMAIN_RE =
  /@(?:www\.)?(?:phalotrans|phalotransportation)\.com\b/gi

const LEGACY_GMAIL = 'info.phalotrans@gmail.com'

function hostOf(value: string): string {
  const bare = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
  return bare
}

function isLegacyHost(host: string): boolean {
  return (
    LEGACY_BRAND_HOSTS.includes(host as (typeof LEGACY_BRAND_HOSTS)[number]) ||
    host.includes('phalotrans') ||
    host.includes('phalotransportation')
  )
}

/**
 * Rewrite any legacy Phalo domain inside free-form text (URLs, footers, etc.).
 * Keeps local-parts for emails: bookings@phalotrans.com → bookings@vipodyssey.com
 */
export function rewriteLegacyBrandText(value: string): string {
  return value
    .replace(LEGACY_EMAIL_DOMAIN_RE, `@${BRAND_WEBSITE}`)
    .replace(new RegExp(LEGACY_GMAIL, 'gi'), BRAND_EMAIL)
    .replace(/https?:\/\/(?:www\.)?phalotransportation\.com\b/gi, BRAND_URL)
    .replace(/https?:\/\/(?:www\.)?phalotrans\.com\b/gi, BRAND_URL)
    .replace(/\b(?:www\.)?phalotransportation\.com\b/gi, BRAND_WEBSITE)
    .replace(/\b(?:www\.)?phalotrans\.com\b/gi, BRAND_WEBSITE)
}

/**
 * Normalize company website for emails/forms.
 * Empty or legacy Phalo domains always resolve to the current brand site.
 */
export function normalizeBrandWebsite(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return BRAND_WEBSITE

  const rewritten = rewriteLegacyBrandText(trimmed)
  const host = hostOf(rewritten)
  if (isLegacyHost(host)) return BRAND_WEBSITE

  // Prefer bare host for footer display (no scheme/path).
  return host || BRAND_WEBSITE
}

/**
 * Normalize a public company / ops email.
 * Empty or legacy Phalo addresses always resolve to the current brand email.
 */
export function normalizeBrandEmail(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return BRAND_EMAIL

  const lower = trimmed.toLowerCase()
  if (lower === LEGACY_GMAIL) return BRAND_EMAIL

  const rewritten = rewriteLegacyBrandText(trimmed)
  if (rewritten.toLowerCase().includes('phalotrans') || rewritten.toLowerCase().includes('phalotransportation')) {
    return BRAND_EMAIL
  }
  return rewritten
}

/**
 * Rewrite a From / Reply-To style address, preserving the local-part when only
 * the domain was legacy (e.g. bookings@phalotrans.com → bookings@vipodyssey.com).
 */
export function rewriteLegacyEmailAddress(value?: string | null, fallback = BRAND_EMAIL): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback

  const lower = trimmed.toLowerCase()
  if (lower === LEGACY_GMAIL || lower.includes(LEGACY_GMAIL)) return fallback

  const rewritten = rewriteLegacyBrandText(trimmed)
  if (!rewritten.includes('@')) return fallback
  return rewritten
}

function normalizePublicUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const rewritten = rewriteLegacyBrandText(trimmed)
  if (rewritten.startsWith('http://') || rewritten.startsWith('https://')) {
    return rewritten.replace(/\/$/, '')
  }
  return `https://${rewritten.replace(/\/$/, '')}`
}

/** Public site base URL for links in emails and redirects. */
export function getSiteUrl(): string {
  const configured = normalizePublicUrl(process.env.SITE_URL)
  if (configured) return configured

  const publicSiteUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_URL)
  if (publicSiteUrl) return publicSiteUrl

  const appUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL) || normalizePublicUrl(process.env.APP_URL)
  if (appUrl) return appUrl

  const nextAuthUrl = normalizePublicUrl(process.env.NEXTAUTH_URL)
  if (nextAuthUrl) return nextAuthUrl

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel && process.env.NODE_ENV !== 'production') {
    return `https://${vercel.replace(/\/$/, '')}`
  }

  return BRAND_URL
}

/** Direct link to a reservation in the manager portal. */
export function getManagerReservationUrl(reservationId: string): string {
  return `${getSiteUrl()}/manager/reservations/${reservationId}`
}

/** Manager list filtered to pending reservations. */
export function getManagerPendingReservationsUrl(): string {
  return `${getSiteUrl()}/manager/reservations?status=pending`
}
