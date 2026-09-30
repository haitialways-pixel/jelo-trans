import Link from "next/link"
import { getTodayReservations } from "@/lib/manager/data"
import type { ManagerReservation } from "@/lib/manager/data"
import { StatusBadge } from "@/components/manager/StatusBadge"
import { formatDateTime, formatMoney } from "@/lib/manager/format"
import { formatManagerUnitLabel } from "@/lib/fleet/unitDisplay"

export const dynamic = "force-dynamic"

function tripEndMs(r: ManagerReservation): number {
  const start = new Date(r.pickup_time).getTime()
  const hours = Number(r.duration_hours) > 0 ? Number(r.duration_hours) : 3
  return start + hours * 60 * 60 * 1000
}

function overlappingIds(trips: ManagerReservation[]): Set<string> {
  const ids = new Set<string>()
  const byUnit = new Map<string, ManagerReservation[]>()
  for (const trip of trips) {
    if (!trip.assigned_unit_id) continue
    const list = byUnit.get(trip.assigned_unit_id) ?? []
    list.push(trip)
    byUnit.set(trip.assigned_unit_id, list)
  }
  for (const list of byUnit.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime(),
    )
    for (let i = 0; i < sorted.length; i++) {
      const aEnd = tripEndMs(sorted[i])
      for (let j = i + 1; j < sorted.length; j++) {
        const bStart = new Date(sorted[j].pickup_time).getTime()
        if (bStart >= aEnd) break
        if (bStart < aEnd) {
          ids.add(sorted[i].id)
          ids.add(sorted[j].id)
        }
      }
    }
  }
  return ids
}

export default async function TodayBoardPage() {
  const trips = await getTodayReservations()
  const conflicts = overlappingIds(trips)
  const conflictTrips = trips.filter((t) => conflicts.has(t.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl font-semibold">Today</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Orlando trips for today. Overlapping assignments are a warning only — bookings are not rejected.
        </p>
      </div>

      {conflictTrips.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <p className="font-medium">Same vehicle on overlapping trips</p>
          <ul className="mt-2 space-y-1 text-on-surface-variant">
            {conflictTrips.map((t) => (
              <li key={t.id}>
                {formatManagerUnitLabel(t.assigned_unit) || t.assigned_unit?.label || "Assigned vehicle"} · {t.booking_number} · {t.customer_name} ·{" "}
                {formatDateTime(t.pickup_time)}
                {t.duration_hours ? ` · ${t.duration_hours}h` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {trips.length === 0 ? (
        <p className="text-on-surface-variant text-sm glass-dark rounded-2xl p-6 text-center">
          No trips scheduled today.
        </p>
      ) : (
        <div className="glass-dark gold-hairline rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/manager/reservations/${t.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t.customer_name}</span>
                  <StatusBadge status={t.status} />
                  {conflicts.has(t.id) && (
                    <span className="text-[11px] rounded-full border border-amber-500/50 px-2 py-0.5 text-amber-800">
                      Overlap
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  {formatManagerUnitLabel(t.assigned_unit) || t.assigned_unit?.label || t.fleet?.name || "No vehicle assigned"} · {t.pickup_address}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm">{formatDateTime(t.pickup_time)}</p>
                <p className="text-xs text-on-surface-variant">{formatMoney(t.total_price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
