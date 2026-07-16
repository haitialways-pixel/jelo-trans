// Shared formatting helpers for email templates.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const TZ = 'America/New_York'

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: TZ,
    })
  } catch {
    return iso
  }
}

export function fmtTime(iso: string): string {
  try {
    return (
      new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: TZ,
      }) + ' (ET)'
    )
  } catch {
    return iso
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TZ,
    })
  } catch {
    return iso
  }
}

export function fmtMoney(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
