import Link from 'next/link'
import { requireStaff, isAdminRole } from '@/lib/manager/auth'
import { getChauffeurs } from '@/lib/manager/data'
import {
  driverPayRows,
  getReportReservations,
  needsAttention,
  reportKpis,
  resolveReportRange,
  toCsv,
  type ReportPreset,
  type ReportStatus,
} from '@/lib/manager/reports'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { formatDateTime, formatMoneyExact, PAYMENT_LABELS } from '@/lib/manager/format'
import { ExportCsvButton } from '@/components/manager/ExportCsvButton'

export const dynamic = 'force-dynamic'

const PRESETS: { key: ReportPreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string
    status?: string
    chauffeur?: string
    from?: string
    to?: string
    year?: string
  }>
}) {
  const staff = await requireStaff()
  const admin = isAdminRole(staff.role)
  const sp = await searchParams
  const preset = (PRESETS.some((p) => p.key === sp.preset) ? sp.preset : 'month') as ReportPreset
  const status = (['all', 'active', 'completed', 'cancelled'].includes(sp.status ?? '')
    ? sp.status
    : 'all') as ReportStatus
  const chauffeurId = sp.chauffeur?.trim() || ''
  const range = resolveReportRange({ preset, from: sp.from, to: sp.to })
  const year = Number(sp.year) || new Date().getFullYear()

  const [rows, companyRevenueRows, chauffeurs] = await Promise.all([
    getReportReservations({
      fromIso: range.fromIso,
      toIso: range.toIso,
      status,
      chauffeurId: chauffeurId || null,
    }),
    getReportReservations({
      fromIso: range.fromIso,
      toIso: range.toIso,
      status: 'completed',
    }),
    getChauffeurs(),
  ])

  const kpis = reportKpis(rows)
  const companyRevenue = reportKpis(companyRevenueRows).revenue
  const attention = needsAttention(rows)
  const completed = rows.filter((r) => r.status === 'completed')
  const chauffeur1099 = new Map(chauffeurs.map((c) => [c.id, c.is_1099_contractor]))
  const payRows = driverPayRows(completed, chauffeur1099)
  const payByDriver = new Map<string, { name: string; pay: number; jobs: number }>()
  for (const p of payRows) {
    const key = p.chauffeur_id || p.chauffeur_name
    const cur = payByDriver.get(key) ?? { name: p.chauffeur_name, pay: 0, jobs: 0 }
    cur.pay += p.driver_pay
    cur.jobs += 1
    payByDriver.set(key, cur)
  }
  const grandPay = payRows.reduce((s, r) => s + r.driver_pay, 0)

  const attentionCsv = toCsv(
    ['Pickup', 'Booking', 'Customer', 'Route', 'Model', 'Status'],
    attention.map((r) => [
      r.pickup_time,
      r.booking_number,
      r.customer_name,
      `${r.pickup_address} → ${r.dropoff_address}`,
      r.fleet?.name ?? '',
      r.status,
    ]),
  )
  const completedCsv = toCsv(
    ['Pickup', 'Booking', 'Customer', 'Total', 'Payment'],
    completed.map((r) => [
      r.pickup_time,
      r.booking_number,
      r.customer_name,
      Number(r.total_price).toFixed(2),
      r.payment_status,
    ]),
  )
  const payCsv = toCsv(
    ['Pickup', 'Booking', 'Chauffeur', '1099', 'Hours', 'The run pays', 'Status'],
    payRows.map((r) => [
      r.pickup_time,
      r.booking_number,
      r.chauffeur_name,
      r.is_1099 ? 'Yes' : 'No',
      r.duration_hours,
      r.driver_pay.toFixed(2),
      r.pay_not_entered ? 'Pay not entered' : 'Entered',
    ]),
  )

  const yearFrom = `${year}-01-01`
  const yearTo = `${year}-12-31`
  const yearRange = resolveReportRange({ preset: 'custom', from: yearFrom, to: yearTo })
  const yearRows = admin
    ? await getReportReservations({
        fromIso: yearRange.fromIso,
        toIso: yearRange.toIso,
        status: 'completed',
      })
    : []
  const yearPay = driverPayRows(yearRows, chauffeur1099)
  const necRows = admin
    ? chauffeurs
        .filter((c) => c.is_1099_contractor)
        .map((c) => {
          const jobs = yearPay.filter((j) => j.chauffeur_id === c.id)
          const box1 = jobs.reduce((s, j) => s + j.driver_pay, 0)
          const missingAddress = !c.address_line1 || !c.city || !c.state || !c.zip
          return { c, jobs: jobs.length, box1, missingAddress, missingTax: !c.hasTaxId }
        })
        .filter((r) => r.box1 > 0)
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-2xl font-semibold">Reports</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Pickup {range.fromYmd} → {range.toYmd}
        </p>
      </div>

      <form className="glass-dark gold-hairline rounded-2xl p-4 flex flex-wrap items-end gap-3" method="get">
        <label className="text-xs space-y-1">
          <span className="text-on-surface-variant uppercase tracking-wide">Range</span>
          <select name="preset" defaultValue={preset} className="block rounded-lg px-3 py-2 text-sm">
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-on-surface-variant uppercase tracking-wide">From</span>
          <input type="date" name="from" defaultValue={range.fromYmd} className="block rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-on-surface-variant uppercase tracking-wide">To</span>
          <input type="date" name="to" defaultValue={range.toYmd} className="block rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-on-surface-variant uppercase tracking-wide">Status</span>
          <select name="status" defaultValue={status} className="block rounded-lg px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-on-surface-variant uppercase tracking-wide">Chauffeur</span>
          <select name="chauffeur" defaultValue={chauffeurId} className="block rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {chauffeurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-primary text-black text-sm font-semibold px-4 py-2">
          Apply
        </button>
        <p className="text-[11px] text-on-surface-variant w-full">
          From/To apply when Range is Custom.
        </p>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Rides', value: String(kpis.rides) },
          { label: 'Completed', value: String(kpis.completed) },
          { label: 'Cancelled', value: String(kpis.cancelled) },
          { label: 'Company revenue', value: formatMoneyExact(companyRevenue) },
          { label: 'Unpaid', value: formatMoneyExact(kpis.unpaid) },
        ].map((c) => (
          <div key={c.label} className="glass-dark gold-hairline rounded-2xl p-5">
            <p className="text-xs text-on-surface-variant">{c.label}</p>
            <p className="display text-2xl font-semibold mt-2">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">Needs attention</h2>
          <ExportCsvButton filename="needs-attention.csv" csv={attentionCsv} />
        </div>
        {attention.length === 0 ? (
          <p className="text-sm text-on-surface-variant glass-dark rounded-2xl p-6 text-center">Nothing needs attention in this range.</p>
        ) : (
          <div className="glass-dark gold-hairline rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-on-surface-variant uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Pickup</th>
                  <th className="text-left px-4 py-2 font-medium">Booking</th>
                  <th className="text-left px-4 py-2 font-medium">Customer</th>
                  <th className="text-left px-4 py-2 font-medium">Route</th>
                  <th className="text-left px-4 py-2 font-medium">Model</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {attention.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container/40">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.pickup_time)}</td>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/manager/reservations/${r.id}`} className="text-primary hover:underline">
                        {r.booking_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.customer_name}</td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {r.pickup_address} → {r.dropoff_address}
                    </td>
                    <td className="px-4 py-3">{r.fleet?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">Completed</h2>
          <ExportCsvButton filename="completed.csv" csv={completedCsv} />
        </div>
        {completed.length === 0 ? (
          <p className="text-sm text-on-surface-variant glass-dark rounded-2xl p-6 text-center">No completed rides in this range.</p>
        ) : (
          <div className="glass-dark gold-hairline rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-on-surface-variant uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Pickup</th>
                  <th className="text-left px-4 py-2 font-medium">Booking</th>
                  <th className="text-left px-4 py-2 font-medium">Customer</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-left px-4 py-2 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {completed.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container/40">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.pickup_time)}</td>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/manager/reservations/${r.id}`} className="text-primary hover:underline">
                        {r.booking_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.customer_name}</td>
                    <td className="px-4 py-3 text-right">{formatMoneyExact(r.total_price)}</td>
                    <td className="px-4 py-3">{PAYMENT_LABELS[r.payment_status] ?? r.payment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">Driver pay</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              The run pays is entered on each driver assignment. Older jobs without an amount count as $0.
            </p>
          </div>
          <ExportCsvButton filename="driver-pay.csv" csv={payCsv} />
        </div>
        {payRows.length === 0 ? (
          <p className="text-sm text-on-surface-variant glass-dark rounded-2xl p-6 text-center">
            No completed jobs with a chauffeur in this range.
          </p>
        ) : (
          <div className="glass-dark gold-hairline rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-on-surface-variant uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Pickup</th>
                  <th className="text-left px-4 py-2 font-medium">Booking</th>
                  <th className="text-left px-4 py-2 font-medium">Chauffeur</th>
                  <th className="text-left px-4 py-2 font-medium">1099</th>
                  <th className="text-right px-4 py-2 font-medium">Hours</th>
                  <th className="text-right px-4 py-2 font-medium">The run pays</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {payRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.pickup_time)}</td>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/manager/reservations/${r.id}`} className="text-primary hover:underline">
                        {r.booking_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.chauffeur_name}</td>
                    <td className="px-4 py-3">{r.is_1099 ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right">{r.duration_hours}</td>
                    <td className="px-4 py-3 text-right">{formatMoneyExact(r.driver_pay)}</td>
                    <td className="px-4 py-3 text-xs text-amber-800">
                      {r.pay_not_entered ? 'Pay not entered' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {[...payByDriver.values()].map((d) => (
                  <tr key={d.name} className="border-t border-outline-variant/30 text-xs">
                    <td className="px-4 py-2" colSpan={6}>
                      {d.name} · {d.jobs} job(s)
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatMoneyExact(d.pay)}</td>
                  </tr>
                ))}
                <tr className="border-t border-outline-variant/40 font-semibold">
                  <td className="px-4 py-3" colSpan={6}>
                    Grand total
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoneyExact(grandPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {admin && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">1099</h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Printable contractor statement. Not an IRS e-file.
              </p>
            </div>
            <form className="flex items-end gap-2" method="get">
              <input type="hidden" name="preset" value={preset} />
              <input type="hidden" name="status" value={status} />
              {chauffeurId ? <input type="hidden" name="chauffeur" value={chauffeurId} /> : null}
              <label className="text-xs space-y-1">
                <span className="text-on-surface-variant uppercase tracking-wide">Year</span>
                <input
                  type="number"
                  name="year"
                  defaultValue={year}
                  className="block w-24 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <button type="submit" className="rounded-lg border border-outline-variant/40 text-sm px-3 py-2">
                Load year
              </button>
            </form>
          </div>
          {necRows.length === 0 ? (
            <p className="text-sm text-on-surface-variant glass-dark rounded-2xl p-6 text-center">
              No 1099 contractors with driver pay in {year}.
            </p>
          ) : (
            <div className="glass-dark gold-hairline rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-on-surface-variant uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Legal name</th>
                    <th className="text-right px-4 py-2 font-medium">Jobs</th>
                    <th className="text-right px-4 py-2 font-medium">Box 1</th>
                    <th className="text-left px-4 py-2 font-medium">Flags</th>
                    <th className="text-right px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {necRows.map(({ c, jobs, box1, missingAddress, missingTax }) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{c.legal_name || c.name}</td>
                      <td className="px-4 py-3 text-right">{jobs}</td>
                      <td className="px-4 py-3 text-right">{formatMoneyExact(box1)}</td>
                      <td className="px-4 py-3 text-xs text-amber-800">
                        {[missingAddress ? 'Address missing' : null, missingTax ? '1099 incomplete' : null]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/manager/reports/1099/print?year=${year}&id=${c.id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          Print
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-outline-variant/15">
                <Link href={`/manager/reports/1099/print?year=${year}`} className="text-sm text-primary hover:underline">
                  Print all eligible
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
