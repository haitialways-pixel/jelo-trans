import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Briefcase,
  Phone,
  Mail,
  Car,
  History,
} from 'lucide-react'
import { getReservation, getVehicleUnits, getAuditLog, getChauffeurs, type ManagerReservation } from '@/lib/manager/data'
import { StatusBadge } from '@/components/manager/StatusBadge'
import { LifecycleControls } from '@/components/manager/LifecycleControls'
import { AssignForm } from '@/components/manager/AssignForm'
import { formatDateTime, formatMoney, formatMoneyExact, PAYMENT_LABELS, SOURCE_LABELS, auditLabel } from '@/lib/manager/format'
import { summarizePayment } from '@/lib/payments/summary'

export const dynamic = 'force-dynamic'

export default async function ReservationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [r, units, audit, chauffeurs] = await Promise.all([
    getReservation(id),
    getVehicleUnits(),
    getAuditLog({ reservationId: id, limit: 30 }),
    getChauffeurs(),
  ])

  if (!r) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/manager/reservations"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to reservations
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="display text-2xl font-semibold">{r.customer_name}</h1>
            <StatusBadge status={r.status} />
          </div>
          <p className="text-on-surface-variant text-sm mt-1">
            <span className="font-mono">{r.booking_number}</span> ·{' '}
            {SOURCE_LABELS[r.source] ?? r.source} ·{' '}
            {PAYMENT_LABELS[r.payment_status] ?? r.payment_status}
          </p>
        </div>
        <div className="text-right">
          <p className="display text-2xl font-semibold text-primary">{formatMoney(r.total_price)}</p>
          <p className="text-xs text-on-surface-variant">{r.duration_hours}h booking</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Trip details */}
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-dark gold-hairline rounded-2xl p-6 space-y-4">
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">Trip details</h2>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-on-surface-variant text-xs">Pickup</p>
                <p>{r.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-on-surface-variant mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-on-surface-variant text-xs">Drop-off</p>
                <p>{r.dropoff_address}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <Detail icon={Clock} label="Pickup time" value={formatDateTime(r.pickup_time)} />
              <Detail icon={Users} label="Passengers" value={String(r.passengers)} />
              <Detail icon={Briefcase} label="Luggage" value={String(r.luggage)} />
              <Detail icon={Car} label="Vehicle" value={r.fleet?.name ?? 'Unassigned'} />
            </div>

            {r.assigned_unit ? (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-2 text-sm">
                <Car className="w-4 h-4 text-primary" />
                <span className="text-on-surface-variant text-xs">Assigned car:</span>
                <span className="font-medium">{r.assigned_unit.label}</span>
              </div>
            ) : (
              (() => {
                const matchingUnits = units.filter((u) => u.model_id === r.vehicle_id)
                const availableUnit = matchingUnits.find((u) => u.status === 'available')
                return (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span className="text-on-surface-variant text-xs">Assigned car:</span>
                      <span className="font-semibold text-amber-700">Auto-Select Pending</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      No specific car assigned yet. The system will automatically select the first available{' '}
                      <span className="text-on-surface font-medium">{r.fleet?.name}</span> (e.g.,{' '}
                      <span className="text-primary font-medium">{availableUnit ? availableUnit.label : 'None available!'}</span>) when confirming/dispatching.
                    </p>
                  </div>
                )
              })()
            )}

            {r.special_requests && (
              <div className="rounded-xl bg-surface-container/50 border border-outline-variant/15 px-4 py-3">
                <p className="text-on-surface-variant text-xs mb-1">Special requests</p>
                <p className="text-sm">{r.special_requests}</p>
              </div>
            )}
          </div>

          {/* Customer contact */}
          <div className="glass-dark gold-hairline rounded-2xl p-6">
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase mb-4">Customer</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <a href={`tel:${r.customer_phone}`} className="flex items-center gap-3 text-sm hover:text-primary transition">
                <Phone className="w-4 h-4 text-primary" /> {r.customer_phone}
              </a>
              <a href={`mailto:${r.customer_email}`} className="flex items-center gap-3 text-sm hover:text-primary transition">
                <Mail className="w-4 h-4 text-primary" /> {r.customer_email}
              </a>
            </div>
          </div>

          {/* Audit trail */}
          <div className="glass-dark gold-hairline rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-sm tracking-widest text-on-surface-variant uppercase mb-4">
              <History className="w-4 h-4" /> Activity log
            </h2>
            {audit.length === 0 ? (
              <p className="text-on-surface-variant text-sm">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <div>
                      <p>{auditLabel(a.action)}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {formatDateTime(a.created_at)}
                        {a.actor_email ? ` · ${a.actor_email}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Action sidebar */}
        <div className="space-y-5">
          <div className="glass-dark gold-hairline rounded-2xl p-6">
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase mb-4">Payment</h2>
            <PaymentPanel r={r} />
          </div>

          <div className="glass-dark gold-hairline rounded-2xl p-6">
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase mb-4">Ride lifecycle</h2>
            <LifecycleControls r={r} />
          </div>

          <div className="glass-dark gold-hairline rounded-2xl p-6">
            <h2 className="text-sm tracking-widest text-on-surface-variant uppercase mb-4">Assignment</h2>
            <AssignForm r={r} units={units} chauffeurs={chauffeurs} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

function PaymentPanel({ r }: { r: ManagerReservation }) {
  const p = summarizePayment({
    totalPrice: r.total_price,
    fareSubtotal: r.fare_subtotal,
    gratuityPercent: r.gratuity_percent,
    gratuityAmount: r.gratuity_amount,
    durationHours: r.duration_hours,
    distanceMiles: r.distance_miles,
    specialRequests: r.special_requests,
    paymentStatus: r.payment_status,
    depositAmount: r.deposit_amount,
    balanceAmount: r.balance_amount,
    depositPaidAt: r.deposit_paid_at,
    balancePaidAt: r.balance_paid_at,
  })

  const headline = p.fullyPaid
    ? 'Fully paid'
    : p.depositCollected
      ? 'Deposit collected'
      : 'No deposit taken'

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl border px-4 py-3 text-center ${
          p.fullyPaid
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <p className="text-xs text-on-surface-variant">{headline}</p>
        <p className="text-[11px] text-on-surface-variant mt-1">Total amount due</p>
        <p
          className={`display text-2xl font-semibold mt-0.5 ${
            p.fullyPaid ? 'text-emerald-700' : 'text-on-surface'
          }`}
        >
          {formatMoneyExact(p.amountDue)}
        </p>
        <p className="text-[11px] text-on-surface-variant mt-1">
          Collected {formatMoneyExact(p.collected)} of {formatMoneyExact(p.total)}
        </p>
      </div>

      {p.isCharter && p.charterHours != null && p.charterHourlyRate != null && (
        <PayRow
          label={`Charter · ${p.charterHours}h × ${formatMoneyExact(p.charterHourlyRate)}/hr`}
          value={formatMoneyExact(p.fareSubtotal ?? p.charterHours * p.charterHourlyRate)}
        />
      )}
      {!p.isCharter && p.fareSubtotal != null && (
        <PayRow
          label={
            p.distanceMiles != null
              ? `Trip fare · ${p.distanceMiles.toFixed(1)} mi`
              : 'Trip fare'
          }
          value={formatMoneyExact(p.fareSubtotal)}
        />
      )}
      {p.gratuityAmount != null && p.gratuityPercent != null && (
        <PayRow
          label={`Gratuity (${p.gratuityPercent}%)`}
          value={formatMoneyExact(p.gratuityAmount)}
        />
      )}
      <PayRow label="Total fare" value={formatMoneyExact(p.total)} emphasize />

      {p.depositCollected ? (
        <PayRow
          label="Deposit"
          value={formatMoneyExact(p.depositAmount)}
          note="collected"
          notePaid
        />
      ) : p.depositScheduled ? (
        <PayRow
          label="Deposit (10%)"
          value={formatMoneyExact(p.depositAmount)}
          note="not collected"
        />
      ) : (
        <PayRow label="Deposit" value="No deposit taken" note="full fare due" />
      )}

      {p.depositCollected && !p.fullyPaid && (
        <PayRow
          label="Balance"
          value={formatMoneyExact(p.balanceAmount)}
          note="due after ride"
        />
      )}

      <PayRow label="Collected" value={formatMoneyExact(p.collected)} />
      <PayRow
        label="Total amount due"
        value={formatMoneyExact(p.amountDue)}
        emphasize
        note={p.fullyPaid ? 'paid in full' : undefined}
        notePaid={p.fullyPaid}
      />
    </div>
  )
}

function PayRow({
  label,
  value,
  note,
  notePaid,
  emphasize,
}: {
  label: string
  value: string
  note?: string
  notePaid?: boolean
  emphasize?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
        emphasize ? 'bg-surface-container/70 font-medium' : 'bg-surface-container/40'
      }`}
    >
      <span className="text-on-surface-variant pr-3">{label}</span>
      <div className="text-right shrink-0">
        <span className="text-on-surface">{value}</span>
        {note ? (
          <span className={`ml-2 text-[11px] ${notePaid ? 'text-emerald-700' : 'text-on-surface-variant'}`}>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  )
}
