'use server'

/**
 * Receipt-only server actions (isolated from the large manager/actions module).
 * Plain-HTML email path — no React Email render (more reliable on Cloudflare Workers).
 */

import { assertStaff } from '@/lib/manager/auth'
import { staffDb } from '@/lib/manager/db'
import {
  sendManualReceiptEmail,
  sendReservationReceiptEmail,
  type ManualReceiptEmailProps,
} from '@/lib/email/sendManualReceiptEmail'
import {
  sendVendorInvoiceEmail,
  type InvoicePaymentMethod,
  type VendorInvoiceEmailProps,
} from '@/lib/email/sendVendorInvoiceEmail'
import { sendSms } from '@/lib/sms/notify'
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/email/format'
import { isMailConfigured, getMailSetupHint } from '@/lib/email/mailer'

export type SendReceiptResult =
  | {
      ok: true
      email?: { sent: boolean; reason?: string }
      sms?: { sent: boolean; reason?: string }
      reference?: string
      warning?: string
    }
  | { ok: false; error: string }

export type ManualReceiptLineInput = {
  description: string
  quantity: number
  unitPrice: number
}

export type ManualReceiptInput = {
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  receiptNumber?: string
  receiptDateTime?: string
  tripType?: 'one_way' | 'round_trip'
  customerName: string
  customerEmail?: string
  customerPhone?: string
  origin?: string
  destination?: string
  departureDateTime?: string
  returnDateTime?: string
  bookingTicketNumber?: string
  items: ManualReceiptLineInput[]
  taxMode?: 'rate' | 'amount'
  taxValue?: number
  discount?: number
  otherFees?: number
  otherFeesLabel?: string
  paymentMethod?: string
  amountPaid?: number
  paymentReference?: string
  channels: { email?: boolean; sms?: boolean }
}

export type VendorInvoiceLineInput = {
  description: string
  quantity: number
  unitPrice: number
}

export type VendorInvoiceInput = {
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  invoiceNumber?: string
  invoiceDateTime?: string
  dueDate?: string
  tripType?: 'one_way' | 'round_trip'
  vendorName: string
  vendorCompany?: string
  vendorEmail: string
  vendorPhone?: string
  origin?: string
  destination?: string
  departureDateTime?: string
  returnDateTime?: string
  bookingTicketNumber?: string
  items: VendorInvoiceLineInput[]
  taxMode?: 'rate' | 'amount'
  taxValue?: number
  discount?: number
  otherFees?: number
  otherFeesLabel?: string
  notes?: string
  /** Payment methods the vendor may use (ACH, Zelle, credit card). */
  acceptedMethods: InvoicePaymentMethod[]
  achInstructions?: string
  zelleInstructions?: string
  cardInstructions?: string
  cardPaymentLink?: string
}

function generateReceiptNumber(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `RCP-${y}${m}${day}-${rand}`
}

function generateInvoiceNumber(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INV-${y}${m}${day}-${rand}`
}

const VALID_INVOICE_METHODS = new Set<InvoicePaymentMethod>(['ach', 'zelle', 'credit_card'])

function parseOptionalIso(value?: string): string | null {
  if (!value?.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function channelSummary(
  wantEmail: boolean,
  wantSms: boolean,
  emailChannel?: { sent: boolean; reason?: string },
  smsChannel?: { sent: boolean; reason?: string },
): SendReceiptResult {
  const emailOk = !wantEmail || emailChannel?.sent
  const smsOk = !wantSms || smsChannel?.sent

  if (!emailOk && !smsOk) {
    const parts: string[] = []
    if (wantEmail) parts.push(`email: ${emailChannel?.reason ?? 'failed'}`)
    if (wantSms) parts.push(`text: ${smsChannel?.reason ?? 'failed'}`)
    return { ok: false, error: `Receipt not delivered (${parts.join('; ')})` }
  }

  let warning: string | undefined
  if (!emailOk || !smsOk) {
    const parts: string[] = []
    if (wantEmail && !emailChannel?.sent) parts.push(`email: ${emailChannel?.reason ?? 'failed'}`)
    if (wantSms && !smsChannel?.sent) parts.push(`text: ${smsChannel?.reason ?? 'failed'}`)
    warning = `Partial delivery — ${parts.join('; ')}`
  }

  return {
    ok: true,
    email: emailChannel,
    sms: smsChannel,
    warning,
  }
}

/**
 * Manually email and/or text a payment receipt for an existing reservation.
 */
export async function sendCustomerReceipt(
  id: string,
  channels: { email?: boolean; sms?: boolean },
  overrides?: { email?: string; phone?: string },
): Promise<SendReceiptResult> {
  try {
    await assertStaff()

    const wantEmail = Boolean(channels.email)
    const wantSms = Boolean(channels.sms)
    if (!wantEmail && !wantSms) {
      return { ok: false, error: 'Select email and/or text.' }
    }

    if (wantEmail && !isMailConfigured()) {
      return {
        ok: false,
        error: getMailSetupHint() ?? 'Email is not configured (RESEND_API_KEY missing).',
      }
    }

    const admin = await staffDb()
    const { data: res, error } = await admin
      .from('reservations')
      .select(
        'id, booking_number, customer_name, customer_email, customer_phone, pickup_address, dropoff_address, pickup_time, status, payment_status, total_price, chauffeur_name, vehicle_id, completed_at, deposit_intent_id, balance_intent_id, fleet:vehicle_id (name)',
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[receipt] reservation lookup failed:', error.message)
      return { ok: false, error: `Could not load reservation: ${error.message}` }
    }
    if (!res) return { ok: false, error: 'Reservation not found' }

    if (res.status === 'cancelled') {
      return { ok: false, error: 'Cannot send a receipt for a cancelled reservation.' }
    }

    const fleet = res.fleet as { name?: string } | { name?: string }[] | null
    const vehicleName = Array.isArray(fleet)
      ? fleet[0]?.name ?? null
      : fleet?.name ?? null

    const toEmail = (overrides?.email ?? res.customer_email ?? '').trim()
    const toPhone = (overrides?.phone ?? res.customer_phone ?? '').trim()
    const total = res.total_price != null ? Number(res.total_price) : null
    const transactionId =
      (res.balance_intent_id as string | null) ??
      (res.deposit_intent_id as string | null) ??
      null
    const paymentMethod = res.payment_status === 'paid' ? 'Card on file' : null

    let emailChannel: { sent: boolean; reason?: string } | undefined
    let smsChannel: { sent: boolean; reason?: string } | undefined

    if (wantEmail) {
      if (!toEmail) {
        emailChannel = { sent: false, reason: 'No email on file' }
      } else {
        const emailResult = await sendReservationReceiptEmail({
          to: toEmail,
          customerName: res.customer_name,
          bookingNumber: res.booking_number,
          pickupAddress: res.pickup_address,
          dropoffAddress: res.dropoff_address,
          pickupTimeLabel: res.pickup_time ? fmtDate(res.pickup_time) : null,
          vehicleName,
          chauffeurName: res.chauffeur_name,
          totalAmount: total,
          paymentMethod,
          transactionId,
          completedAtLabel: res.completed_at
            ? fmtDate(res.completed_at)
            : fmtDate(new Date().toISOString()),
        })
        emailChannel = { sent: emailResult.sent, reason: emailResult.reason }
      }
    }

    if (wantSms) {
      if (!toPhone) {
        smsChannel = { sent: false, reason: 'No phone on file' }
      } else {
        const tripDate = res.pickup_time ? fmtDate(res.pickup_time) : 'N/A'
        const totalLabel = total != null ? fmtMoney(total) : 'N/A'
        const body = [
          `Imperial Odyssey receipt`,
          `Booking #${res.booking_number}`,
          `Total: ${totalLabel}`,
          `Date: ${tripDate}`,
          res.pickup_address ? `From: ${res.pickup_address}` : null,
          res.dropoff_address ? `To: ${res.dropoff_address}` : null,
          res.payment_status === 'paid' ? 'Status: Paid' : `Payment: ${res.payment_status}`,
          `Thank you! Qs: 678-478-3506`,
        ]
          .filter(Boolean)
          .join('\n')

        const smsResult = await sendSms({ to: toPhone, body })
        smsChannel = { sent: smsResult.sent, reason: smsResult.reason }
      }
    }

    const result = channelSummary(wantEmail, wantSms, emailChannel, smsChannel)
    if (!result.ok) return result
    return { ...result, reference: res.booking_number }
  } catch (e) {
    console.error('[receipt] sendCustomerReceipt error:', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Send receipt failed' }
  }
}

/**
 * Send a free-form itemized payment receipt (not tied to a reservation row).
 */
export async function sendManualReceipt(input: ManualReceiptInput): Promise<SendReceiptResult> {
  try {
    await assertStaff()

    const wantEmail = Boolean(input.channels?.email)
    const wantSms = Boolean(input.channels?.sms)
    if (!wantEmail && !wantSms) {
      return { ok: false, error: 'Select email and/or text.' }
    }

    if (wantEmail && !isMailConfigured()) {
      return {
        ok: false,
        error: getMailSetupHint() ?? 'Email is not configured (RESEND_API_KEY missing).',
      }
    }

    const customerName = input.customerName?.trim()
    if (!customerName) return { ok: false, error: 'Customer name is required.' }

    const toEmail = (input.customerEmail ?? '').trim()
    const toPhone = (input.customerPhone ?? '').trim()
    if (wantEmail && !toEmail) return { ok: false, error: 'Email is required to email a receipt.' }
    if (wantSms && !toPhone) return { ok: false, error: 'Phone is required to text a receipt.' }

    const rawItems = Array.isArray(input.items) ? input.items : []
    const items = rawItems
      .map((row) => {
        const description = String(row?.description ?? '').trim()
        const quantity = Number(row?.quantity)
        const unitPrice = Number(row?.unitPrice)
        if (
          !description ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(unitPrice)
        ) {
          return null
        }
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100
        return { description, quantity, unitPrice, lineTotal }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)

    if (items.length === 0) {
      return {
        ok: false,
        error: 'Add at least one item (description, quantity, unit price).',
      }
    }

    const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100

    const taxMode = input.taxMode === 'amount' ? 'amount' : 'rate'
    const taxValue = Number(input.taxValue ?? 0)
    let taxAmount = 0
    let taxLabel = 'Tax'
    if (Number.isFinite(taxValue) && taxValue > 0) {
      if (taxMode === 'rate') {
        taxAmount = Math.round(subtotal * (taxValue / 100) * 100) / 100
        taxLabel = `Tax (${taxValue}%)`
      } else {
        taxAmount = Math.round(taxValue * 100) / 100
      }
    }

    const discount =
      Number.isFinite(Number(input.discount)) && Number(input.discount) > 0
        ? Math.round(Number(input.discount) * 100) / 100
        : 0
    const otherFees =
      Number.isFinite(Number(input.otherFees)) && Number(input.otherFees) > 0
        ? Math.round(Number(input.otherFees) * 100) / 100
        : 0

    const grandTotal = Math.round((subtotal + taxAmount + otherFees - discount) * 100) / 100
    if (grandTotal < 0) {
      return { ok: false, error: 'Grand total cannot be negative. Check discount.' }
    }

    const amountPaid =
      input.amountPaid == null || Number.isNaN(Number(input.amountPaid))
        ? grandTotal
        : Number(input.amountPaid)
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      return { ok: false, error: 'Enter a valid amount paid.' }
    }

    const receiptNumber = (input.receiptNumber?.trim() || generateReceiptNumber()).toUpperCase()
    const receiptIso = parseOptionalIso(input.receiptDateTime) ?? new Date().toISOString()
    const departureIso = parseOptionalIso(input.departureDateTime)
    const returnIso = parseOptionalIso(input.returnDateTime)
    const tripType =
      input.tripType === 'round_trip' || input.tripType === 'one_way' ? input.tripType : undefined

    const companyName = input.companyName?.trim() || 'Imperial Odyssey, LLC'
    const companyAddress = input.companyAddress?.trim() || 'Orlando, Florida'
    const companyPhone = input.companyPhone?.trim() || '(678) 478-3506'
    const companyEmail = input.companyEmail?.trim() || 'info@phalotrans.com'
    const companyWebsite = input.companyWebsite?.trim() || 'phalotrans.com'

    const emailProps: ManualReceiptEmailProps = {
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      receiptNumber,
      receiptDateTime: fmtDateTime(receiptIso),
      tripType,
      customerName,
      customerEmail: toEmail || undefined,
      customerPhone: toPhone || undefined,
      origin: input.origin?.trim() || undefined,
      destination: input.destination?.trim() || undefined,
      departureDateTime: departureIso ? fmtDateTime(departureIso) : undefined,
      returnDateTime: returnIso ? fmtDateTime(returnIso) : undefined,
      bookingTicketNumber: input.bookingTicketNumber?.trim() || undefined,
      items,
      subtotal,
      taxLabel,
      taxAmount,
      discountAmount: discount,
      otherFees,
      otherFeesLabel: input.otherFeesLabel?.trim() || 'Other fees',
      grandTotal,
      paymentMethod: input.paymentMethod?.trim() || undefined,
      amountPaid: Math.round(amountPaid * 100) / 100,
      paymentReference: input.paymentReference?.trim() || undefined,
    }

    let emailChannel: { sent: boolean; reason?: string } | undefined
    let smsChannel: { sent: boolean; reason?: string } | undefined

    if (wantEmail) {
      const emailResult = await sendManualReceiptEmail(toEmail, emailProps)
      emailChannel = { sent: emailResult.sent, reason: emailResult.reason }
    }

    if (wantSms) {
      const body = [
        `${companyName} receipt`,
        `#${receiptNumber}`,
        `Total: ${fmtMoney(grandTotal)}`,
        `Paid: ${fmtMoney(emailProps.amountPaid)}${emailProps.paymentMethod ? ` (${emailProps.paymentMethod})` : ''}`,
        emailProps.origin ? `From: ${emailProps.origin}` : null,
        emailProps.destination ? `To: ${emailProps.destination}` : null,
        departureIso ? `Depart: ${fmtDate(departureIso)}` : null,
        `Thank you! ${companyPhone}`,
      ]
        .filter(Boolean)
        .join('\n')

      const smsResult = await sendSms({ to: toPhone, body })
      smsChannel = { sent: smsResult.sent, reason: smsResult.reason }
    }

    const result = channelSummary(wantEmail, wantSms, emailChannel, smsChannel)
    if (!result.ok) return result
    return { ...result, reference: receiptNumber }
  } catch (e) {
    console.error('[receipt] sendManualReceipt error:', e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Send manual receipt failed',
    }
  }
}

/**
 * Email a vendor invoice for a completed trip (amount due, not a paid receipt).
 * Accepts ACH, Zelle, and/or credit card payment instructions.
 */
export async function sendVendorInvoice(input: VendorInvoiceInput): Promise<SendReceiptResult> {
  try {
    await assertStaff()

    if (!isMailConfigured()) {
      return {
        ok: false,
        error: getMailSetupHint() ?? 'Email is not configured (RESEND_API_KEY missing).',
      }
    }

    const vendorName = input.vendorName?.trim()
    if (!vendorName) return { ok: false, error: 'Vendor / bill-to name is required.' }

    const toEmail = (input.vendorEmail ?? '').trim()
    if (!toEmail) return { ok: false, error: 'Vendor email is required to send an invoice.' }

    const acceptedMethods = (Array.isArray(input.acceptedMethods) ? input.acceptedMethods : [])
      .filter((m): m is InvoicePaymentMethod => VALID_INVOICE_METHODS.has(m as InvoicePaymentMethod))
    if (acceptedMethods.length === 0) {
      return {
        ok: false,
        error: 'Select at least one payment option (ACH, Zelle, or Credit card).',
      }
    }

    const rawItems = Array.isArray(input.items) ? input.items : []
    const items = rawItems
      .map((row) => {
        const description = String(row?.description ?? '').trim()
        const quantity = Number(row?.quantity)
        const unitPrice = Number(row?.unitPrice)
        if (
          !description ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(unitPrice)
        ) {
          return null
        }
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100
        return { description, quantity, unitPrice, lineTotal }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)

    if (items.length === 0) {
      return {
        ok: false,
        error: 'Add at least one line item (description, quantity, unit price).',
      }
    }

    const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100

    const taxMode = input.taxMode === 'amount' ? 'amount' : 'rate'
    const taxValue = Number(input.taxValue ?? 0)
    let taxAmount = 0
    let taxLabel = 'Tax'
    if (Number.isFinite(taxValue) && taxValue > 0) {
      if (taxMode === 'rate') {
        taxAmount = Math.round(subtotal * (taxValue / 100) * 100) / 100
        taxLabel = `Tax (${taxValue}%)`
      } else {
        taxAmount = Math.round(taxValue * 100) / 100
      }
    }

    const discount =
      Number.isFinite(Number(input.discount)) && Number(input.discount) > 0
        ? Math.round(Number(input.discount) * 100) / 100
        : 0
    const otherFees =
      Number.isFinite(Number(input.otherFees)) && Number(input.otherFees) > 0
        ? Math.round(Number(input.otherFees) * 100) / 100
        : 0

    const amountDue = Math.round((subtotal + taxAmount + otherFees - discount) * 100) / 100
    if (amountDue < 0) {
      return { ok: false, error: 'Amount due cannot be negative. Check discount.' }
    }
    if (amountDue === 0) {
      return { ok: false, error: 'Amount due must be greater than zero.' }
    }

    const invoiceNumber = (input.invoiceNumber?.trim() || generateInvoiceNumber()).toUpperCase()
    const invoiceIso = parseOptionalIso(input.invoiceDateTime) ?? new Date().toISOString()
    const dueIso = parseOptionalIso(input.dueDate)
    const departureIso = parseOptionalIso(input.departureDateTime)
    const returnIso = parseOptionalIso(input.returnDateTime)
    const tripType =
      input.tripType === 'round_trip' || input.tripType === 'one_way' ? input.tripType : undefined

    const companyName = input.companyName?.trim() || 'Imperial Odyssey, LLC'
    const companyAddress = input.companyAddress?.trim() || 'Orlando, Florida'
    const companyPhone = input.companyPhone?.trim() || '(678) 478-3506'
    const companyEmail = input.companyEmail?.trim() || 'info@phalotrans.com'
    const companyWebsite = input.companyWebsite?.trim() || 'phalotrans.com'

    const emailProps: VendorInvoiceEmailProps = {
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      invoiceNumber,
      invoiceDate: fmtDateTime(invoiceIso),
      dueDate: dueIso ? fmtDate(dueIso) : undefined,
      tripType,
      vendorName,
      vendorCompany: input.vendorCompany?.trim() || undefined,
      vendorEmail: toEmail,
      vendorPhone: input.vendorPhone?.trim() || undefined,
      origin: input.origin?.trim() || undefined,
      destination: input.destination?.trim() || undefined,
      departureDateTime: departureIso ? fmtDateTime(departureIso) : undefined,
      returnDateTime: returnIso ? fmtDateTime(returnIso) : undefined,
      bookingTicketNumber: input.bookingTicketNumber?.trim() || undefined,
      items,
      subtotal,
      taxLabel,
      taxAmount,
      discountAmount: discount,
      otherFees,
      otherFeesLabel: input.otherFeesLabel?.trim() || 'Other fees',
      amountDue,
      notes: input.notes?.trim() || undefined,
      acceptedMethods,
      achInstructions: acceptedMethods.includes('ach')
        ? input.achInstructions?.trim() || undefined
        : undefined,
      zelleInstructions: acceptedMethods.includes('zelle')
        ? input.zelleInstructions?.trim() || undefined
        : undefined,
      cardInstructions: acceptedMethods.includes('credit_card')
        ? input.cardInstructions?.trim() || undefined
        : undefined,
      cardPaymentLink: acceptedMethods.includes('credit_card')
        ? input.cardPaymentLink?.trim() || undefined
        : undefined,
    }

    const emailResult = await sendVendorInvoiceEmail(toEmail, emailProps)
    if (!emailResult.sent) {
      return {
        ok: false,
        error: `Invoice not delivered (email: ${emailResult.reason ?? 'failed'})`,
      }
    }

    return {
      ok: true,
      email: { sent: true },
      reference: invoiceNumber,
    }
  } catch (e) {
    console.error('[receipt] sendVendorInvoice error:', e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Send invoice failed',
    }
  }
}
