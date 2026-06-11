import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getReservations } from '@/lib/manager/data'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { formatDateTime, formatMoney, STATUS_LABELS } from '@/lib/manager/format'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const active = status && STATUS_LABELS[status] ? status : ''
  const reservations = await getReservations(active ? { status: active } : undefined)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl font-semibold">Reservations</h1>
        <p className="text-on-surface-variant text-sm mt-1">{reservations.length} result(s)</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTERS.map((f) => {
          const isActive = active === f.key
          return (
            <Link
              key={f.key}
              href={f.key ? `/manager/reservations?status=${f.key}` : '/manager/reservations'}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs transition ${
                isActive
                  ? 'bg-primary text-black font-medium'
                  : 'border border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {reservations.length === 0 ? (
        <p className="text-on-surface-variant text-sm glass-dark rounded-2xl p-8 text-center">
          No reservations in this view.
        </p>
      ) : (
        <div className="glass-dark gold-hairline rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">
          {reservations.map((r) => (
            <Link
              key={r.id}
              href={`/manager/reservations/${r.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.customer_name}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  <span className="font-mono">{r.booking_number}</span> · {r.fleet?.name ?? 'No vehicle'}
                  {r.chauffeur_name ? ` · ${r.chauffeur_name}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm">{formatDateTime(r.pickup_time)}</p>
                <p className="text-xs text-on-surface-variant">{formatMoney(r.total_price)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
