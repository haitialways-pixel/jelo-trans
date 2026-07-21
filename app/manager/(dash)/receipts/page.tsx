import Link from 'next/link'
import {
  getReservations,
  getSentInvoices,
  getVendors,
  searchReservations,
} from '@/lib/manager/data'
import { ReservationSearch } from '@/components/manager/ReservationSearch'
import { ReceiptSender } from '@/components/manager/ReceiptSender'
import { CreateManualReceiptForm } from '@/components/manager/CreateManualReceiptForm'
import { SendInvoiceForm } from '@/components/manager/SendInvoiceForm'
import { SentInvoicesList } from '@/components/manager/SentInvoicesList'
import { isSmsConfigured } from '@/lib/sms/notify'
import { isMailConfigured, getMailSetupHint } from '@/lib/email/mailer'
import { STATUS_LABELS } from '@/lib/manager/format'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: '', label: 'All' },
]

function filterHref(status: string, query: string) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (query.trim()) params.set('q', query.trim())
  const qs = params.toString()
  return qs ? `/manager/receipts?${qs}` : '/manager/receipts'
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  // Default to completed — most receipt sends are post-ride.
  const active =
    status === undefined
      ? 'completed'
      : status && STATUS_LABELS[status]
        ? status
        : ''
  const query = (q ?? '').trim()
  const smsConfigured = isSmsConfigured()
  const mailConfigured = isMailConfigured()
  const mailHint = getMailSetupHint()

  let reservations: Awaited<ReturnType<typeof getReservations>> = []
  let vendors: Awaited<ReturnType<typeof getVendors>> = []
  let invoices: Awaited<ReturnType<typeof getSentInvoices>> = []
  try {
    reservations = query
      ? await searchReservations(query, active ? { status: active, limit: 40 } : { limit: 40 })
      : await getReservations(active ? { status: active, limit: 40 } : { limit: 40 })
  } catch (e) {
    console.error('[receipts page] failed to load reservations:', e)
  }
  try {
    vendors = await getVendors()
  } catch (e) {
    console.error('[receipts page] failed to load vendors:', e)
  }
  try {
    invoices = await getSentInvoices({ limit: 50 })
  } catch (e) {
    console.error('[receipts page] failed to load invoices:', e)
  }

  // Receipts are most relevant for non-cancelled bookings; newest trips first.
  const list = reservations
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => {
      const ta = new Date(a.completed_at ?? a.pickup_time).getTime()
      const tb = new Date(b.completed_at ?? b.pickup_time).getTime()
      return tb - ta
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold">Receipts</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Email or text a payment receipt to the customer, send a vendor invoice for completed
            trips, or create a manual receipt for cash / off-system payments.
          </p>
        </div>
        <CreateManualReceiptForm smsConfigured={smsConfigured} />
        <SendInvoiceForm vendors={vendors} />
      </div>

      {!mailConfigured && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Email receipts are unavailable: {mailHint ?? 'RESEND_API_KEY is not set.'}
        </div>
      )}
      {mailConfigured && mailHint && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          {mailHint}
        </div>
      )}
      {!smsConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          Text receipts are unavailable until Twilio is configured (
          <code className="text-xs">TWILIO_ACCOUNT_SID</code>,{' '}
          <code className="text-xs">TWILIO_AUTH_TOKEN</code>,{' '}
          <code className="text-xs">TWILIO_FROM_NUMBER</code>).
        </div>
      )}

      <SentInvoicesList invoices={invoices} />

      <div className="border-t border-outline-variant/20 pt-6 space-y-4">
        <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">
          Customer receipts
        </h2>
      <ReservationSearch defaultQuery={query} status={active} />

      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTERS.map((f) => {
          const isActive = active === f.key
          return (
            <Link
              key={f.key || 'all'}
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

      <p className="text-xs text-on-surface-variant">
        {list.length} reservation(s)
        {query ? ` matching “${query}”` : ''}
        {active ? ` · ${STATUS_LABELS[active] ?? active}` : ''}
      </p>

      {list.length === 0 ? (
        <p className="text-on-surface-variant text-sm glass-dark rounded-2xl p-8 text-center">
          {query
            ? 'No reservations match your search.'
            : active === 'completed'
              ? 'No completed rides yet. Mark a ride complete, or search by booking number.'
              : 'No reservations in this view.'}
        </p>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <ReceiptSender key={r.id} reservation={r} smsConfigured={smsConfigured} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
