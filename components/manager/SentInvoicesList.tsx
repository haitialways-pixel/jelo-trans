'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
} from 'lucide-react'
import type { StoredInvoice } from '@/lib/manager/data'
import { resendStoredInvoice } from '@/lib/manager/receiptActions'
import { formatDateTime } from '@/lib/manager/format'

function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function tripTypeLabel(t: StoredInvoice['trip_type']): string {
  if (t === 'round_trip') return 'Round trip'
  if (t === 'charter') return 'Charter'
  if (t === 'one_way') return 'One-way'
  return '—'
}

function methodLabel(m: string): string {
  if (m === 'ach') return 'ACH'
  if (m === 'zelle') return 'Zelle'
  if (m === 'credit_card') return 'Credit card'
  return m
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  // due_date may be YYYY-MM-DD without time
  const d = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SentInvoicesList({ invoices }: { invoices: StoredInvoice[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function resend(inv: StoredInvoice) {
    setPendingId(inv.id)
    start(async () => {
      try {
        const res = await resendStoredInvoice(inv.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`Invoice ${res.reference ?? inv.invoice_number} resent`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Resend failed')
      } finally {
        setPendingId(null)
      }
    })
  }

  if (invoices.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">
            Sent invoices
          </h2>
        </div>
        <p className="text-on-surface-variant text-sm glass-dark rounded-2xl p-6 text-center">
          No invoices stored yet. Use <strong>Send invoice</strong> to bill a vendor — each send is
          saved here for later retrieval.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm tracking-widest text-on-surface-variant uppercase">
            Sent invoices
          </h2>
        </div>
        <p className="text-xs text-on-surface-variant">
          {invoices.length} stored invoice{invoices.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-3">
        {invoices.map((inv) => {
          const open = expandedId === inv.id
          const busy = pending && pendingId === inv.id
          const billTo = [inv.vendor_company, inv.vendor_name].filter(Boolean).join(' · ')

          return (
            <article
              key={inv.id}
              className="glass-dark gold-hairline rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : inv.id)}
                className="w-full text-left p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3 hover:bg-surface-container/20 transition"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">
                      {inv.invoice_number}
                    </span>
                    {inv.status === 'void' && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                        Void
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant">
                      {tripTypeLabel(inv.trip_type)}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1 truncate">{billTo || inv.vendor_name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    To {inv.sent_to}
                    {' · '}
                    Sent {formatDateTime(inv.sent_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="display text-lg font-semibold text-primary tabular-nums">
                      {money(inv.amount_due)}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Due {formatDateOnly(inv.due_date)}
                    </p>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-on-surface-variant" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                  )}
                </div>
              </button>

              {open && (
                <div className="border-t border-outline-variant/20 px-4 sm:px-5 pb-5 pt-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <Detail label="Invoice date" value={formatDateTime(inv.invoice_date)} />
                    <Detail label="Due date" value={formatDateOnly(inv.due_date)} />
                    <Detail label="Trip type" value={tripTypeLabel(inv.trip_type)} />
                    {inv.duration_hours != null && inv.duration_hours > 0 && (
                      <Detail
                        label="Duration"
                        value={`${inv.duration_hours} hour${inv.duration_hours === 1 ? '' : 's'}`}
                      />
                    )}
                    {inv.booking_ticket_number && (
                      <Detail label="Booking / ticket #" value={inv.booking_ticket_number} />
                    )}
                    <Detail label="Vendor email" value={inv.vendor_email} />
                    {inv.vendor_phone && <Detail label="Vendor phone" value={inv.vendor_phone} />}
                  </div>

                  {(inv.origin || inv.destination || inv.departure_at) && (
                    <div className="rounded-xl bg-surface-container/40 border border-outline-variant/15 px-3 py-2 text-sm space-y-1">
                      <p className="text-[11px] text-on-surface-variant uppercase tracking-wide">
                        Trip
                      </p>
                      {inv.origin && (
                        <p>
                          <span className="text-on-surface-variant">From: </span>
                          {inv.origin}
                        </p>
                      )}
                      {inv.destination && (
                        <p>
                          <span className="text-on-surface-variant">
                            {inv.trip_type === 'charter' ? 'Service area: ' : 'To: '}
                          </span>
                          {inv.destination}
                        </p>
                      )}
                      {inv.departure_at && (
                        <p>
                          <span className="text-on-surface-variant">Start: </span>
                          {formatDateTime(inv.departure_at)}
                        </p>
                      )}
                      {inv.return_at && (
                        <p>
                          <span className="text-on-surface-variant">Return: </span>
                          {formatDateTime(inv.return_at)}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] text-on-surface-variant uppercase tracking-wide mb-2">
                      Line items
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] text-on-surface-variant border-b border-outline-variant/20">
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-3 py-2 font-medium text-right">Qty</th>
                            <th className="px-3 py-2 font-medium text-right">Unit</th>
                            <th className="px-3 py-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.items.map((item, i) => (
                            <tr
                              key={`${inv.id}-item-${i}`}
                              className="border-b border-outline-variant/10 last:border-0"
                            >
                              <td className="px-3 py-2">{item.description}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {money(item.unitPrice)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {money(item.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container/30 px-3 py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Subtotal</span>
                      <span className="tabular-nums">{money(inv.subtotal)}</span>
                    </div>
                    {inv.tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">
                          {inv.tax_label || 'Tax'}
                        </span>
                        <span className="tabular-nums">{money(inv.tax_amount)}</span>
                      </div>
                    )}
                    {inv.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Discount</span>
                        <span className="tabular-nums">-{money(inv.discount_amount)}</span>
                      </div>
                    )}
                    {inv.other_fees > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">
                          {inv.other_fees_label || 'Other fees'}
                        </span>
                        <span className="tabular-nums">{money(inv.other_fees)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold pt-1 border-t border-outline-variant/15">
                      <span>Amount due</span>
                      <span className="text-primary tabular-nums">{money(inv.amount_due)}</span>
                    </div>
                  </div>

                  {inv.accepted_methods.length > 0 && (
                    <p className="text-xs text-on-surface-variant">
                      Payment options:{' '}
                      {inv.accepted_methods.map(methodLabel).join(' · ')}
                    </p>
                  )}

                  {inv.notes && (
                    <div>
                      <p className="text-[11px] text-on-surface-variant uppercase tracking-wide mb-1">
                        Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => resend(inv)}
                      disabled={busy || inv.status === 'void'}
                      className="inline-flex items-center gap-2 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium px-4 py-2.5 transition disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Resend email
                    </button>
                    <a
                      href={`mailto:${encodeURIComponent(inv.sent_to)}?subject=${encodeURIComponent(`Invoice ${inv.invoice_number}`)}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 text-sm font-medium px-4 py-2.5 hover:bg-surface-container/40 transition"
                    >
                      <Mail className="w-4 h-4" />
                      Open in mail
                    </a>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container/30 border border-outline-variant/15 px-3 py-2">
      <p className="text-[11px] text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-sm break-words">{value}</p>
    </div>
  )
}
