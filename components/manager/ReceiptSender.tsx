'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, MessageSquare, Send, Loader2, Phone } from 'lucide-react'
import { sendCustomerReceipt } from '@/lib/manager/receiptActions'
import type { ManagerReservation } from '@/lib/manager/data'
import { formatDateTime, formatMoney, PAYMENT_LABELS } from '@/lib/manager/format'
import { StatusBadge } from '@/components/manager/StatusBadge'

export function ReceiptSender({
  reservation: r,
  smsConfigured,
}: {
  reservation: ManagerReservation
  smsConfigured: boolean
}) {
  const [pending, start] = useTransition()
  const [email, setEmail] = useState(r.customer_email ?? '')
  const [phone, setPhone] = useState(r.customer_phone ?? '')
  const [wantEmail, setWantEmail] = useState(true)
  const [wantSms, setWantSms] = useState(smsConfigured)

  function send(channels: { email: boolean; sms: boolean }) {
    if (!channels.email && !channels.sms) {
      toast.error('Select email and/or text')
      return
    }
    start(async () => {
      try {
        const res = await sendCustomerReceipt(r.id, channels, {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.warning) {
          toast.warning(res.warning)
          return
        }
        const parts: string[] = []
        if (res.email?.sent) parts.push('email')
        if (res.sms?.sent) parts.push('text')
        toast.success(
          parts.length ? `Receipt sent via ${parts.join(' & ')}` : 'Receipt sent',
        )
      } catch {
        toast.error('Request failed — try refreshing the page.')
      }
    })
  }

  return (
    <article className="glass-dark gold-hairline rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{r.customer_name}</h3>
            <StatusBadge status={r.status} />
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            <span className="font-mono">{r.booking_number}</span>
            {' · '}
            {formatDateTime(r.pickup_time)}
            {' · '}
            {r.fleet?.name ?? 'No vehicle'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="display text-xl font-semibold text-primary">{formatMoney(r.total_price)}</p>
          <p className="text-[11px] text-on-surface-variant">
            {PAYMENT_LABELS[r.payment_status] ?? r.payment_status}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-container/40 border border-outline-variant/15 px-3 py-2">
          <p className="text-[11px] text-on-surface-variant mb-0.5">Pickup</p>
          <p className="truncate" title={r.pickup_address}>
            {r.pickup_address}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container/40 border border-outline-variant/15 px-3 py-2">
          <p className="text-[11px] text-on-surface-variant mb-0.5">Drop-off</p>
          <p className="truncate" title={r.dropoff_address}>
            {r.dropoff_address}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mb-1">
            <Mail className="w-3.5 h-3.5" /> Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            className="w-full px-3 py-2 rounded-xl text-sm bg-card border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/70"
          />
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mb-1">
            <Phone className="w-3.5 h-3.5" /> Phone
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1…"
            className="w-full px-3 py-2 rounded-xl text-sm bg-card border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/70"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wantEmail}
            onChange={(e) => setWantEmail(e.target.checked)}
            className="rounded border-outline-variant"
          />
          <Mail className="w-3.5 h-3.5 text-primary" />
          Email receipt
        </label>
        <label
          className={`flex items-center gap-2 text-sm select-none ${
            smsConfigured ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
          }`}
          title={smsConfigured ? undefined : 'Twilio is not configured'}
        >
          <input
            type="checkbox"
            checked={wantSms && smsConfigured}
            disabled={!smsConfigured}
            onChange={(e) => setWantSms(e.target.checked)}
            className="rounded border-outline-variant"
          />
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          Text receipt
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => send({ email: wantEmail, sms: wantSms && smsConfigured })}
          disabled={pending || (!wantEmail && !(wantSms && smsConfigured))}
          className="gold-shimmer flex items-center justify-center gap-2 font-semibold tracking-wide text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send receipt
        </button>
        <button
          type="button"
          onClick={() => send({ email: true, sms: false })}
          disabled={pending || !email.trim()}
          className="flex items-center gap-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-sm font-medium px-4 py-2.5 transition disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          Email only
        </button>
        {smsConfigured && (
          <button
            type="button"
            onClick={() => send({ email: false, sms: true })}
            disabled={pending || !phone.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 text-sm font-medium px-4 py-2.5 transition disabled:opacity-50"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Text only
          </button>
        )}
      </div>
    </article>
  )
}
