/** Public site base URL for links in emails (set SITE_URL on Vercel). */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return `https://${vercel.replace(/\/$/, '')}`
  }

  return 'http://localhost:3000'
}

/** Direct link to a reservation in the manager portal. */
export function getManagerReservationUrl(reservationId: string): string {
  return `${getSiteUrl()}/manager/reservations/${reservationId}`
}

/** Manager list filtered to pending reservations. */
export function getManagerPendingReservationsUrl(): string {
  return `${getSiteUrl()}/manager/reservations?status=pending`
}