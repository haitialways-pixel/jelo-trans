import Link from 'next/link'
import { Clock, CarFront, CheckCircle2, MessageSquareWarning, ChevronRight } from 'lucide-react'
import { getDashboardStats, getReservations, getSupportRequests } from '@/lib/manager/data'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { formatDateTime, formatMoney } from '@/lib/manager/format'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const ACTIVE = ['pending', 'confirmed', 'in_progress']

export default async function ManagerDashboard() {
  const [stats, all, escalations] = await Promise.all([
    getDashboardStats(),
    getReservations({ limit: 50 }),
    getSupportRequests(5),
  ])

  const upcoming = all.filter((r) => ACTIVE.includes(r.status)).slice(0, 8)

  const cards = [
    { label: 'To confirm', value: stats.pending, icon: Clock, tint: 'text-zinc-300' },
    { label: "Today's rides", value: stats.todayCount, icon: CarFront, tint: 'text-primary' },
    { label: 'In progress', value: stats.inProgress, icon: CheckCircle2, tint: 'text-blue-300' },
    { label: 'Open escalations', value: stats.openEscalations, icon: MessageSquareWarning, tint: 'text-amber-300' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-2xl font-semibold">Today at a glance</h1>
        <p className="text-on-surface-variant text-sm mt-1">Operations overview for Phalo Transportation.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-dark gold-hairline rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.tint}`} />
            </div>
            <p className="display text-3xl font-semibold mt-3">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming rides */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">Upcoming rides</h2>
          <Link href="/manager/reservations" className="text-primary text-xs hover:underline">
            View all
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-on-surface-variant text-sm glass-dark rounded-2xl p-6 text-center">
            No active reservations.
          </p>
        ) : (
          <div className="glass-dark gold-hairline rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">
            {upcoming.map((r) => (
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
                    {r.fleet?.name ?? 'No vehicle'} · {r.pickup_address}
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
      </section>

      {/* Escalations from the chatbot */}
      {escalations.length > 0 && (
        <section>
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase mb-3">
            Chatbot escalations
          </h2>
          <div className="glass-dark gold-hairline rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">
            {escalations.map((e) => (
              <div key={e.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {e.customer_name ?? 'Anonymous'}{' '}
                    {e.customer_phone && (
                      <span className="text-on-surface-variant font-normal">· {e.customer_phone}</span>
                    )}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">{formatDateTime(e.created_at)}</span>
                </div>
                <p className="text-sm text-on-surface-variant mt-1">{e.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
