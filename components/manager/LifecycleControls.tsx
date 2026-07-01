'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, ChevronRight, Ban, CheckCircle2 } from 'lucide-react'
import { advanceReservation, type Stage } from '@/lib/manager/actions'
import { formatDateTime } from '@/lib/manager/format'
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
  const router = useRouter()
  const terminal = r.status === 'cancelled' || r.status === 'completed'

  function run(stage: Stage, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    start(async () => {
      try {
        const res = await advanceReservation(r.id, stage)
        if (res.ok) {
          toast.success('Reservation updated')
          router.refresh()
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
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <Ban className="w-4 h-4" /> This reservation was cancelled.
      </div>
    )
  }

  if (r.status === 'completed') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Ride completed on {formatDateTime(r.completed_at)}.
        <span className="text-emerald-300/70">Balance charge will trigger here (Stripe — Phase C).</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Confirm step (pending → confirmed) */}
      {r.status === 'pending' && (
        <button
          onClick={() => run('confirm')}
          disabled={pending}
          className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-wide text-sm py-3 rounded-xl disabled:opacity-60"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Confirm reservation
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
                    done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <div>
                  <p className="text-sm">{step.label}</p>
                  {done && <p className="text-[11px] text-emerald-300/80">{formatDateTime(doneAt)}</p>}
                </div>
              </div>

              {!done && (
                <button
                  onClick={() =>
                    run(step.stage, isComplete ? 'Mark this ride as completed?' : undefined)
                  }
                  disabled={pending || r.status === 'pending'}
                  title={r.status === 'pending' ? 'Confirm the reservation first' : undefined}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    isComplete
                      ? 'border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
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
          className="flex items-center gap-1.5 text-xs text-red-300/80 hover:text-red-300 transition disabled:opacity-50"
        >
          <Ban className="w-3.5 h-3.5" /> Cancel reservation
        </button>
      )}
    </div>
  )
}
