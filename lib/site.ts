/** Canonical public domain for booking/reservation links. */
export const SITE_DOMAIN = 'www.vipodyssey.com'

function normalizePublicUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '')
  }
  return `https://${trimmed.replace(/\/$/, '')}`
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

  return `https://${SITE_DOMAIN}`
}

/** Direct link to a reservation in the manager portal. */
export function getManagerReservationUrl(reservationId: string): string {
  return `${getSiteUrl()}/manager/reservations/${reservationId}`
}

/** Manager list filtered to pending reservations. */
export function getManagerPendingReservationsUrl(): string {
  return `${getSiteUrl()}/manager/reservations?status=pending`
}