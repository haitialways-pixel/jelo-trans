import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getReservations, searchReservations, getFleetModels } from '@/lib/manager/data'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { CreateReservationForm } from '@/components/manager/CreateReservationForm'
import { ReservationSearch } from '@/components/manager/ReservationSearch'
import { formatDateTime, formatMoney, STATUS_LABELS } from '@/lib/manager/format'
import { formatManagerUnitLabel } from '@/lib/fleet/unitDisplay'
import { logManagerRender } from '@/lib/manager/timing'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

function listHref(status: string, query: string, page?: number) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (query.trim()) params.set('q', query.trim())
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/manager/reservations?${qs}` : '/manager/reservations'
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const startedAt = Date.now()
  const { status, q, page: pageRaw } = await searchParams
  const active = status && STATUS_LABELS[status] ? status : ''
  const query = (q ?? '').trim()
  const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const paging = { limit: PAGE_SIZE + 1, offset, ...(active ? { status: active } : {}) }

  const [fetched, fleet] = await Promise.all([
    query ? searchReservations(query, paging) : getReservations(paging),
    getFleetModels(),
  ])
  const hasMore = fetched.length > PAGE_SIZE
  const reservations = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched
  logManagerRender('/manager/reservations', startedAt)

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
              href={listHref(f.key, query)}
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
                  {' · '}
                  {formatManagerUnitLabel(r.assigned_unit) ||
                    r.assigned_unit?.label ||
                    r.fleet?.name ||
                    'No vehicle'}
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

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          {page > 1 ? (
            <Link href={listHref(active, query, page - 1)} className="text-sm text-primary hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-on-surface-variant">Page {page}</span>
          {hasMore ? (
            <Link href={listHref(active, query, page + 1)} className="text-sm text-primary hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}