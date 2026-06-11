/** Shared display helpers for the manager UI. */

export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-zinc-700/40 text-zinc-200 border-zinc-500/40',
  confirmed: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  in_progress: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/40',
}

export const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Deposit paid',
  paid: 'Paid',
  refunded: 'Refunded',
}

/** The ride lifecycle, in order. Each step maps to a milestone timestamp column. */
export const LIFECYCLE_STEPS: { stage: string; label: string; field: string }[] = [
  { stage: 'confirm', label: 'Confirmed', field: 'status_confirmed' },
  { stage: 'dispatch', label: 'Chauffeur en route', field: 'dispatched_at' },
  { stage: 'arrive_pickup', label: 'Arrived at pickup', field: 'arrived_pickup_at' },
  { stage: 'onboard', label: 'Passenger on board', field: 'onboard_at' },
  { stage: 'arrive_dropoff', label: 'Arrived at destination', field: 'arrived_dropoff_at' },
  { stage: 'complete', label: 'Ride completed', field: 'completed_at' },
]

/** Human label for an audit action key. */
export function auditLabel(action: string): string {
  const map: Record<string, string> = {
    reservation_confirm: 'Confirmed reservation',
    reservation_dispatch: 'Dispatched chauffeur',
    reservation_arrive_pickup: 'Arrived at pickup',
    reservation_onboard: 'Passenger on board',
    reservation_arrive_dropoff: 'Arrived at destination',
    reservation_complete: 'Completed ride',
    reservation_cancel: 'Cancelled reservation',
    reservation_assign: 'Assigned vehicle / chauffeur',
    vehicle_status: 'Changed vehicle status',
  }
  return map[action] ?? action
}
