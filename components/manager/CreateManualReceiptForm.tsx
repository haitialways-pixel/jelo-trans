'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  X,
  Mail,
  MessageSquare,
  Send,
  Receipt,
  Trash2,
} from 'lucide-react'
import { sendManualReceipt } from '@/lib/manager/receiptActions'

type LineItem = {
  key: string
  description: string
  quantity: string
  unitPrice: string
}

function newLine(partial?: Partial<LineItem>): LineItem {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: partial?.description ?? '',
    quantity: partial?.quantity ?? '1',
    unitPrice: partial?.unitPrice ?? '',
  }
}

function localDatetimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const COMPANY_DEFAULTS = {
  companyName: 'Imperial Odyssey, LLC',
  companyAddress: 'Orlando, Florida',
  companyPhone: '(678) 478-3506',
  companyEmail: 'info@phalotrans.com',
  companyWebsite: 'phalotrans.com',
}

type FormState = typeof COMPANY_DEFAULTS & {
  receiptNumber: string
  receiptDateTime: string
  tripType: 'one_way' | 'round_trip'
  customerName: string
  customerEmail: string
  customerPhone: string
  origin: string
  destination: string
  departureDateTime: string
  returnDateTime: string
  bookingTicketNumber: string
  taxMode: 'rate' | 'amount'
  taxValue: string
  discount: string
  otherFees: string
  otherFeesLabel: string
  paymentMethod: string
  amountPaid: string
  paymentReference: string
}

function emptyForm(): FormState {
  return {
    ...COMPANY_DEFAULTS,
    receiptNumber: '',
    receiptDateTime: localDatetimeValue(),
    tripType: 'one_way',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    origin: '',
    destination: '',
    departureDateTime: '',
    returnDateTime: '',
    bookingTicketNumber: '',
    taxMode: 'rate',
    taxValue: '',
    discount: '',
    otherFees: '',
    otherFeesLabel: '',
    paymentMethod: 'Cash',
    amountPaid: '',
    paymentReference: '',
  }
}

function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs tracking-widest text-on-surface-variant uppercase border-b border-outline-variant/20 pb-2">
      {children}
    </h3>
  )
}

export function CreateManualReceiptForm({ smsConfigured }: { smsConfigured: boolean }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [items, setItems] = useState<LineItem[]>([newLine()])
  const [wantEmail, setWantEmail] = useState(true)
  const [wantSms, setWantSms] = useState(smsConfigured)

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function reset() {
    setForm(emptyForm())
    setItems([newLine()])
    setWantEmail(true)
    setWantSms(smsConfigured)
  }

  const totals = useMemo(() => {
    const parsed = items.map((row) => {
      const quantity = parseFloat(row.quantity)
      const unitPrice = parseFloat(row.unitPrice)
      const ok =
        row.description.trim() &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        Number.isFinite(unitPrice)
      const lineTotal = ok ? Math.round(quantity * unitPrice * 100) / 100 : 0
      return { ok: Boolean(ok), lineTotal }
    })
    const subtotal = Math.round(parsed.reduce((s, r) => s + r.lineTotal, 0) * 100) / 100
    const taxRaw = parseFloat(form.taxValue)
    let taxAmount = 0
    if (Number.isFinite(taxRaw) && taxRaw > 0) {
      taxAmount =
        form.taxMode === 'rate'
          ? Math.round(subtotal * (taxRaw / 100) * 100) / 100
          : Math.round(taxRaw * 100) / 100
    }
    const discount =
      Number.isFinite(parseFloat(form.discount)) && parseFloat(form.discount) > 0
        ? Math.round(parseFloat(form.discount) * 100) / 100
        : 0
    const otherFees =
      Number.isFinite(parseFloat(form.otherFees)) && parseFloat(form.otherFees) > 0
        ? Math.round(parseFloat(form.otherFees) * 100) / 100
        : 0
    const grandTotal = Math.round((subtotal + taxAmount + otherFees - discount) * 100) / 100
    const amountPaid =
      form.amountPaid.trim() === ''
        ? grandTotal
        : Number.isFinite(parseFloat(form.amountPaid))
          ? parseFloat(form.amountPaid)
          : grandTotal
    return { subtotal, taxAmount, discount, otherFees, grandTotal, amountPaid }
  }, [items, form.taxMode, form.taxValue, form.discount, form.otherFees, form.amountPaid])

  function submit() {
    if (!form.customerName.trim()) {
      toast.error('Customer name is required')
      return
    }
    const validItems = items
      .map((row) => ({
        description: row.description.trim(),
        quantity: parseFloat(row.quantity),
        unitPrice: parseFloat(row.unitPrice),
      }))
      .filter(
        (row) =>
          row.description &&
          Number.isFinite(row.quantity) &&
          row.quantity > 0 &&
          Number.isFinite(row.unitPrice),
      )
    if (validItems.length === 0) {
      toast.error('Add at least one item (description | quantity | unit price)')
      return
    }
    if (!wantEmail && !(wantSms && smsConfigured)) {
      toast.error('Select email and/or text')
      return
    }
    if (wantEmail && !form.customerEmail.trim()) {
      toast.error('Customer email is required to email a receipt')
      return
    }
    if (wantSms && smsConfigured && !form.customerPhone.trim()) {
      toast.error('Customer phone is required to text a receipt')
      return
    }

    start(async () => {
      try {
        const res = await sendManualReceipt({
          companyName: form.companyName.trim() || undefined,
          companyAddress: form.companyAddress.trim() || undefined,
          companyPhone: form.companyPhone.trim() || undefined,
          companyEmail: form.companyEmail.trim() || undefined,
          companyWebsite: form.companyWebsite.trim() || undefined,
          receiptNumber: form.receiptNumber.trim() || undefined,
          receiptDateTime: form.receiptDateTime
            ? new Date(form.receiptDateTime).toISOString()
            : undefined,
          tripType: form.tripType,
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim() || undefined,
          customerPhone: form.customerPhone.trim() || undefined,
          origin: form.origin.trim() || undefined,
          destination: form.destination.trim() || undefined,
          departureDateTime: form.departureDateTime
            ? new Date(form.departureDateTime).toISOString()
            : undefined,
          returnDateTime:
            form.tripType === 'round_trip' && form.returnDateTime
              ? new Date(form.returnDateTime).toISOString()
              : undefined,
          bookingTicketNumber: form.bookingTicketNumber.trim() || undefined,
          items: validItems,
          taxMode: form.taxMode,
          taxValue: form.taxValue.trim() ? parseFloat(form.taxValue) : undefined,
          discount: form.discount.trim() ? parseFloat(form.discount) : undefined,
          otherFees: form.otherFees.trim() ? parseFloat(form.otherFees) : undefined,
          otherFeesLabel: form.otherFeesLabel.trim() || undefined,
          paymentMethod: form.paymentMethod.trim() || undefined,
          amountPaid: form.amountPaid.trim() ? parseFloat(form.amountPaid) : undefined,
          paymentReference: form.paymentReference.trim() || undefined,
          channels: {
            email: wantEmail,
            sms: wantSms && smsConfigured,
          },
        })

        if (!res.ok) {
          toast.error(res.error)
          return
        }

        const refLabel = res.reference ? ` · ${res.reference}` : ''
        if (res.warning) {
          toast.warning(`${res.warning}${refLabel}`)
        } else {
          const parts: string[] = []
          if (res.email?.sent) parts.push('email')
          if (res.sms?.sent) parts.push('text')
          toast.success(
            `Receipt sent via ${parts.join(' & ') || 'selected channels'}${refLabel}`,
          )
          reset()
          setOpen(false)
        }
      } catch (e) {
        console.error('[CreateManualReceiptForm] send failed:', e)
        toast.error(
          e instanceof Error
            ? e.message
            : 'Could not send receipt. Refresh the page and try again.',
        )
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium px-4 py-2.5 transition"
      >
        <Plus className="w-4 h-4" /> Create manual receipt
      </button>
    )
  }

  return (
    <div className="w-full basis-full glass-dark gold-hairline rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm tracking-widest text-on-surface-variant uppercase">
            <Receipt className="w-4 h-4" /> Manual receipt
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Full itemized receipt for cash, Zelle, or off-system trips. Does not create a reservation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            reset()
          }}
          className="text-on-surface-variant hover:text-on-surface shrink-0"
          aria-label="Close form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Company Information */}
      <section className="space-y-3">
        <SectionTitle>Company information</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Company name"
            value={form.companyName}
            onChange={(v) => update('companyName', v)}
          />
          <Field
            label="Address"
            value={form.companyAddress}
            onChange={(v) => update('companyAddress', v)}
          />
          <Field
            label="Phone"
            value={form.companyPhone}
            onChange={(v) => update('companyPhone', v)}
          />
          <Field
            label="Email"
            type="email"
            value={form.companyEmail}
            onChange={(v) => update('companyEmail', v)}
          />
          <Field
            label="Website"
            value={form.companyWebsite}
            onChange={(v) => update('companyWebsite', v)}
          />
        </div>
      </section>

      {/* Receipt Details */}
      <section className="space-y-3">
        <SectionTitle>Receipt details</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Receipt number"
            value={form.receiptNumber}
            onChange={(v) => update('receiptNumber', v)}
            placeholder="Auto-generated if blank (RCP-…)"
          />
          <Field
            label="Date & time"
            type="datetime-local"
            value={form.receiptDateTime}
            onChange={(v) => update('receiptDateTime', v)}
          />
          <div className="sm:col-span-2">
            <p className="text-xs text-on-surface-variant mb-1.5">Trip type</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  checked={form.tripType === 'one_way'}
                  onChange={() => update('tripType', 'one_way')}
                />
                One-Way
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  checked={form.tripType === 'round_trip'}
                  onChange={() => update('tripType', 'round_trip')}
                />
                Round Trip
              </label>
            </div>
          </div>
          <Field
            label="Customer name *"
            value={form.customerName}
            onChange={(v) => update('customerName', v)}
          />
          <Field
            label="Customer email (optional)"
            type="email"
            value={form.customerEmail}
            onChange={(v) => update('customerEmail', v)}
          />
          <Field
            label="Customer phone (optional)"
            type="tel"
            value={form.customerPhone}
            onChange={(v) => update('customerPhone', v)}
          />
        </div>
      </section>

      {/* Journey */}
      <section className="space-y-3">
        <SectionTitle>Journey / service details</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field
              label="Origin / From"
              value={form.origin}
              onChange={(v) => update('origin', v)}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Destination / To"
              value={form.destination}
              onChange={(v) => update('destination', v)}
            />
          </div>
          <Field
            label="Departure date & time"
            type="datetime-local"
            value={form.departureDateTime}
            onChange={(v) => update('departureDateTime', v)}
          />
          {form.tripType === 'round_trip' && (
            <Field
              label="Return date & time"
              type="datetime-local"
              value={form.returnDateTime}
              onChange={(v) => update('returnDateTime', v)}
            />
          )}
          <Field
            label="Booking / ticket number"
            value={form.bookingTicketNumber}
            onChange={(v) => update('bookingTicketNumber', v)}
            placeholder="Optional"
          />
        </div>
      </section>

      {/* Line items */}
      <section className="space-y-3">
        <SectionTitle>Items / services</SectionTitle>
        <p className="text-[11px] text-on-surface-variant">
          Format: item description · quantity · unit price
        </p>
        <div className="space-y-2">
          {items.map((row, idx) => {
            const qty = parseFloat(row.quantity)
            const price = parseFloat(row.unitPrice)
            const line =
              Number.isFinite(qty) && Number.isFinite(price) ? qty * price : null
            return (
              <div
                key={row.key}
                className="grid grid-cols-12 gap-2 items-end rounded-xl border border-outline-variant/20 bg-surface-container/30 p-3"
              >
                <div className="col-span-12 sm:col-span-5">
                  <Field
                    label={idx === 0 ? 'Description' : ''}
                    value={row.description}
                    onChange={(v) =>
                      setItems((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, description: v } : r)),
                      )
                    }
                    placeholder="e.g. Airport transfer — MCO to hotel"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Field
                    label={idx === 0 ? 'Qty' : ''}
                    type="number"
                    value={row.quantity}
                    onChange={(v) =>
                      setItems((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, quantity: v } : r)),
                      )
                    }
                    min="0"
                    step="1"
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <Field
                    label={idx === 0 ? 'Unit price ($)' : ''}
                    type="number"
                    value={row.unitPrice}
                    onChange={(v) =>
                      setItems((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, unitPrice: v } : r)),
                      )
                    }
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2 sm:col-span-2 flex flex-col justify-end pb-2">
                  <span className="text-[11px] text-on-surface-variant hidden sm:block mb-1">
                    {idx === 0 ? 'Line total' : '\u00a0'}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {line != null ? money(line) : '—'}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end pb-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.length <= 1 ? [newLine()] : prev.filter((r) => r.key !== row.key),
                      )
                    }
                    className="p-2 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition"
                    aria-label="Remove line item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newLine()])}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Add line item
        </button>
      </section>

      {/* Additional charges */}
      <section className="space-y-3">
        <SectionTitle>Additional charges</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1.5">Tax</label>
            <div className="flex gap-2">
              <select
                value={form.taxMode}
                onChange={(e) => update('taxMode', e.target.value as 'rate' | 'amount')}
                className="rounded-lg px-3 py-2.5 text-sm bg-card border border-outline-variant/30 shrink-0"
              >
                <option value="rate">Rate %</option>
                <option value="amount">Amount $</option>
              </select>
              <input
                type="number"
                value={form.taxValue}
                onChange={(e) => update('taxValue', e.target.value)}
                step="0.01"
                min="0"
                placeholder={form.taxMode === 'rate' ? 'e.g. 7' : '0.00'}
                className="w-full rounded-lg px-3 py-2.5 text-sm bg-card border border-outline-variant/30"
              />
            </div>
          </div>
          <Field
            label="Discount ($)"
            type="number"
            value={form.discount}
            onChange={(v) => update('discount', v)}
            step="0.01"
            min="0"
          />
          <Field
            label="Other fees ($)"
            type="number"
            value={form.otherFees}
            onChange={(v) => update('otherFees', v)}
            step="0.01"
            min="0"
          />
          <Field
            label="Other fees label"
            value={form.otherFeesLabel}
            onChange={(v) => update('otherFeesLabel', v)}
            placeholder="e.g. Airport fee, gratuity"
          />
        </div>
      </section>

      {/* Payment */}
      <section className="space-y-3">
        <SectionTitle>Payment</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1.5">Payment method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => update('paymentMethod', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm bg-card border border-outline-variant/30"
            >
              <option value="Cash">Cash</option>
              <option value="Zelle">Zelle</option>
              <option value="Venmo">Venmo</option>
              <option value="Card">Card</option>
              <option value="Check">Check</option>
              <option value="Invoice / Net terms">Invoice / Net terms</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <Field
            label="Amount paid ($)"
            type="number"
            value={form.amountPaid}
            onChange={(v) => update('amountPaid', v)}
            step="0.01"
            min="0"
            placeholder={`Defaults to ${money(totals.grandTotal)}`}
          />
          <Field
            label="Payment reference (optional)"
            value={form.paymentReference}
            onChange={(v) => update('paymentReference', v)}
            placeholder="Confirmation / last 4 / check #"
          />
        </div>
      </section>

      {/* Live totals */}
      <div className="rounded-xl border border-outline-variant/25 bg-surface-container/40 px-4 py-3 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Subtotal</span>
          <span>{money(totals.subtotal)}</span>
        </div>
        {totals.taxAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">
              Tax{form.taxMode === 'rate' && form.taxValue ? ` (${form.taxValue}%)` : ''}
            </span>
            <span>{money(totals.taxAmount)}</span>
          </div>
        )}
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Discount</span>
            <span>-{money(totals.discount)}</span>
          </div>
        )}
        {totals.otherFees > 0 && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">
              {form.otherFeesLabel.trim() || 'Other fees'}
            </span>
            <span>{money(totals.otherFees)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold pt-1 border-t border-outline-variant/20">
          <span>Grand total</span>
          <span className="text-primary">{money(totals.grandTotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-on-surface-variant">
          <span>Amount paid</span>
          <span>{money(totals.amountPaid)}</span>
        </div>
      </div>

      {/* Delivery */}
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

      <button
        type="button"
        onClick={submit}
        disabled={pending || (!wantEmail && !(wantSms && smsConfigured))}
        className="gold-shimmer w-full flex items-center justify-center gap-2 font-semibold tracking-wide text-sm py-3 rounded-xl disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {pending ? 'Sending…' : 'Send manual receipt'}
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
  min,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  step?: string
  min?: string
}) {
  return (
    <div>
      {label ? (
        <label className="block text-xs text-on-surface-variant mb-1.5">{label}</label>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full rounded-lg px-3 py-2.5 text-sm bg-card border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/70"
      />
    </div>
  )
}
