'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, ChevronRight, Ban, CheckCircle2, Mail, X } from 'lucide-react'
import {
  advanceReservation,
  chargeReservationDeposit,
  resendConfirmationEmail,
  type CompleteSettlement,
  type ConfirmDepositChoice,
  type Stage,
} from '@/lib/manager/actions'
import { formatDateTime, formatMoneyExact } from '@/lib/manager/format'
import { computeDepositAmount, summarizePayment } from '@/lib/payments/summary'
import type { ManagerReservation } from '@/lib/manager/data'

const STEPS: { stage: Stage; label: string; field: keyof ManagerReservation }[] = [
  { stage: 'dispatch', label: 'Chauffeur en route', field: 'dispatched_at' },
  { stage: 'arrive_pickup', label: 'Arrived at pickup', field: 'arrived_pickup_at' },
  { stage: 'onboard', label: 'Passenger on board', field: 'onboard_at' },
  { stage: 'arrive_dropoff', label: 'Arrived at destination', field: 'arrived_dropoff_at' },
  { stage: 'complete', label: 'Ride completed', field: 'completed_at' },
]

export function LifecycleControls({ r }: { r: ManagerReservation }) {
  const [pending, start] = useTransition()
  const [payOpen, setPayOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()
  const terminal = r.status === 'cancelled' || r.status === 'completed'

  const canResendConfirmation = r.status === 'confirmed' || r.status === 'in_progress'
  const canChargeDeposit =
    !terminal && r.status !== 'pending' && !Boolean(r.deposit_paid_at)
  const pay = summarizePayment({
    totalPrice: r.total_price,
    fareSubtotal: r.fare_subtotal,
    gratuityPercent: r.gratuity_percent,
    gratuityAmount: r.gratuity_amount,
    durationHours: r.duration_hours,
    paymentStatus: r.payment_status,
    depositAmount: r.deposit_amount,
    balanceAmount: r.balance_amount,
    depositPaidAt: r.deposit_paid_at,
    balancePaidAt: r.balance_paid_at,
  })
  const depositDue = pay.depositAmount > 0 ? pay.depositAmount : computeDepositAmount(r.total_price)

  useEffect(() => {
    if (!payOpen && !confirmOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) {
        setPayOpen(false)
        setConfirmOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payOpen, confirmOpen, pending])

  function run(stage: Stage, confirmMsg?: string, settlement?: CompleteSettlement) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    start(async () => {
      try {
        const res = await advanceReservation(
          r.id,
          stage,
          stage === 'complete' ? { settlement } : undefined,
        )
        if (res.ok) {
          setPayOpen(false)
          if (res.warning) toast.warning(res.warning)
          else toast.success('Reservation updated')
          router.refresh()
        } else {
          toast.error(res.error)
        }
      } catch {
        toast.error('Request failed — try refreshing the page.')
      }
    })
  }

  function runConfirm(choice: ConfirmDepositChoice) {
    start(async () => {
      try {
        const res = await advanceReservation(r.id, 'confirm', { confirmDeposit: choice })
        if (res.ok) {
          setConfirmOpen(false)
          if (res.warning) toast.warning(res.warning)
          else toast.success('Trip is confirmed')
          router.refresh()
        } else {
          toast.error(res.error)
        }
      } catch {
        toast.error('Request failed — try refreshing the page.')
      }
    })
  }

  function chargeDepositNow() {
    start(async () => {
      try {
        const res = await chargeReservationDeposit(r.id)
        if (res.ok) {
          if (res.warning) toast.warning(res.warning)
          else toast.success('25% deposit charged')
          router.refresh()
        } else {
          toast.error(res.error)
        }
      } catch {
        toast.error('Request failed — try refreshing the page.')
      }
    })
  }

  function resendConfirmation() {
    start(async () => {
      try {
        const res = await resendConfirmationEmail(r.id)
        if (res.ok) {
          toast.success(`Confirmation email sent to ${r.customer_email}`)
        } else {
          toast.error(res.error)
        }
      } catch {
        toast.error('Request failed — try refreshing the page.')
      }
    })
  }

  if (r.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <Ban className="w-4 h-4" /> This reservation was cancelled.
      </div>
    )
  }

  if (r.status === 'completed') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" /> Ride completed on {formatDateTime(r.completed_at)}.
        <span className="text-emerald-700/70">
          {r.balance_paid_at ? 'Balance recorded as paid.' : 'Balance was not recorded as paid.'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Confirm step (pending → confirmed) */}
      {r.status === 'pending' && (
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-wide text-sm py-3 rounded-xl disabled:opacity-60"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Confirm reservation
        </button>
      )}

      {canResendConfirmation && (
        <button
          onClick={resendConfirmation}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-sm font-medium py-2.5 transition disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Resend confirmation email
        </button>
      )}

      {canChargeDeposit && (
        <button
          onClick={chargeDepositNow}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-sm font-medium py-2.5 transition disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Charge {formatMoneyExact(depositDue)} deposit
        </button>
      )}

      {/* Lifecycle timeline */}
      <ol className="space-y-1.5">
        {STEPS.map((step) => {
          const doneAt = r[step.field] as string | null
          const done = Boolean(doneAt)
          const isComplete = step.stage === 'complete'
          return (
            <li
              key={step.stage}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                done
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : 'border-outline-variant/20 bg-surface-container/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                    done ? 'bg-emerald-500/20 text-emerald-700' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <div>
                  <p className="text-sm">{step.label}</p>
                  {done && <p className="text-[11px] text-emerald-700/80">{formatDateTime(doneAt)}</p>}
                </div>
              </div>

              {!done && (
                <button
                  onClick={() => (isComplete ? setPayOpen(true) : run(step.stage))}
                  disabled={pending || r.status === 'pending'}
                  title={r.status === 'pending' ? 'Confirm the reservation first' : undefined}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    isComplete
                      ? 'border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10'
                      : 'border border-primary/40 text-primary hover:bg-primary/10'
                  }`}
                >
                  {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {isComplete ? 'Complete' : 'Mark'}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      {/* Cancel (danger) */}
      {!terminal && (
        <button
          onClick={() => run('cancel', 'Cancel this reservation? This cannot be undone.')}
          disabled={pending}
          className="flex items-center gap-1.5 text-xs text-red-600/80 hover:text-red-700 transition disabled:opacity-50"
        >
          <Ban className="w-3.5 h-3.5" /> Cancel reservation
        </button>
      )}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-deposit-title"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          <div
            className="float-card w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="confirm-deposit-title" className="display text-xl font-semibold">
                  Confirm reservation
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Choose how to handle the 25% deposit. Nothing is charged until you pick Charge now.
                  The deposit stays refundable until 24 hours before pickup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-outline-variant px-4 py-3 text-center">
              <p className="text-xs text-on-surface-variant">25% deposit</p>
              <p className="display text-2xl font-semibold mt-1">{formatMoneyExact(depositDue)}</p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => runConfirm('charge_now')}
                disabled={pending}
                className="btn-cta w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Charge now
              </button>
              <button
                type="button"
                onClick={() => runConfirm('process_later')}
                disabled={pending}
                className="btn-cta w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Process later
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="w-full text-sm text-on-surface-variant py-2 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-pay-title"
          onClick={() => !pending && setPayOpen(false)}
        >
          <div
            className="float-card w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="complete-pay-title" className="display text-xl font-semibold">
                  Complete ride
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Collect the balance, then the ride will be marked complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                disabled={pending}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-outline-variant px-4 py-3 text-center">
              <p className="text-xs text-on-surface-variant">Balance due</p>
              <p className="display text-2xl font-semibold mt-1">{formatMoneyExact(pay.amountDue)}</p>
              {pay.depositCollected ? (
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Deposit {formatMoneyExact(pay.depositAmount)} already collected — unchanged.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => run('complete', undefined, 'card')}
                disabled={pending}
                className="btn-cta w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Charge saved card
              </button>
              <button
                type="button"
                onClick={() => run('complete', undefined, 'cash')}
                disabled={pending}
                className="btn-cta w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Cash received
              </button>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                disabled={pending}
                className="w-full text-sm text-on-surface-variant py-2 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
