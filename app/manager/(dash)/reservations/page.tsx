import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getReservations, searchReservations, getFleetModels } from '@/lib/manager/data'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { CreateReservationForm } from '@/components/manager/CreateReservationForm'
import { ReservationSearch } from '@/components/manager/ReservationSearch'
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

function filterHref(status: string, query: string) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (query.trim()) params.set('q', query.trim())
  const qs = params.toString()
  return qs ? `/manager/reservations?${qs}` : '/manager/reservations'
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const active = status && STATUS_LABELS[status] ? status : ''
  const query = (q ?? '').trim()

  const [reservations, fleet] = await Promise.all([
    query
      ? searchReservations(query, active ? { status: active } : undefined)
      : getReservations(active ? { status: active } : undefined),
    getFleetModels(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold">Reservations</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {reservations.length} result(s)
            {query ? ` for “${query}”` : ''}
          </p>
        </div>
        <CreateReservationForm fleet={fleet} />
      </div>

      <ReservationSearch defaultQuery={query} status={active} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTERS.map((f) => {
          const isActive = active === f.key
          return (
            <Link
              key={f.key}
              href={filterHref(f.key, query)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs transition ${
                isActive
                  ? 'bg-gold/25 text-on-surface font-medium border border-gold/40'
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
          {query ? 'No reservations match your search.' : 'No reservations in this view.'}
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
                  <span className="font-mono">{r.booking_number}</span>
                  {' · '}{r.customer_phone}
                  {r.source === 'manual' ? ' · Manual' : ''}
                  {' · '}{r.fleet?.name ?? 'No vehicle'}
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