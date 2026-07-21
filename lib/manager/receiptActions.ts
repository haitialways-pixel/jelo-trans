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
import { revalidatePath } from 'next/cache'

export type InvoiceTripType = 'one_way' | 'round_trip' | 'charter'

export type VendorActionResult =
  | { ok: true; vendor?: { id: string; name: string; company: string | null; email: string; phone: string | null } }
  | { ok: false; error: string }

export type SendReceiptResult =
  | {
      ok: true
      email?: { sent: boolean; reason?: string }
      sms?: { sent: boolean; reason?: string }
      reference?: string
      invoiceId?: string
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
  tripType?: InvoiceTripType
  /** Hours for charter / as-directed service. */
  durationHours?: number
  vendorId?: string
  vendorName: string
  vendorCompany?: string
  vendorEmail: string
  vendorPhone?: string
  /** When true, create or update the vendor row after a successful send. */
  saveVendor?: boolean
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
    const tripType: InvoiceTripType | undefined =
      input.tripType === 'round_trip' ||
      input.tripType === 'one_way' ||
      input.tripType === 'charter'
        ? input.tripType
        : undefined

    const durationHoursRaw = Number(input.durationHours)
    const durationHours =
      tripType === 'charter' &&
      Number.isFinite(durationHoursRaw) &&
      durationHoursRaw > 0
        ? Math.round(durationHoursRaw * 100) / 100
        : undefined

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
      durationHours,
      vendorName,
      vendorCompany: input.vendorCompany?.trim() || undefined,
      vendorEmail: toEmail,
      vendorPhone: input.vendorPhone?.trim() || undefined,
      origin: input.origin?.trim() || undefined,
      destination: input.destination?.trim() || undefined,
      departureDateTime: departureIso ? fmtDateTime(departureIso) : undefined,
      returnDateTime:
        tripType === 'round_trip' && returnIso ? fmtDateTime(returnIso) : undefined,
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

    // Persist vendor when requested (new or update selected).
    let vendorId = input.vendorId?.trim() || undefined
    const warnings: string[] = []
    if (input.saveVendor !== false) {
      const saveResult = await upsertVendorRecord({
        id: vendorId,
        name: vendorName,
        company: input.vendorCompany?.trim() || undefined,
        email: toEmail,
        phone: input.vendorPhone?.trim() || undefined,
      })
      if (!saveResult.ok) {
        warnings.push(`vendor not saved: ${saveResult.error}`)
      } else if (saveResult.vendor?.id) {
        vendorId = saveResult.vendor.id
      }
    }

    // Always store sent invoices for later retrieval.
    const storeResult = await insertInvoiceRecord({
      invoiceNumber,
      vendorId,
      vendorName,
      vendorCompany: input.vendorCompany?.trim() || undefined,
      vendorEmail: toEmail,
      vendorPhone: input.vendorPhone?.trim() || undefined,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      invoiceDate: invoiceIso,
      dueDate: dueIso,
      tripType,
      durationHours,
      origin: input.origin?.trim() || undefined,
      destination: input.destination?.trim() || undefined,
      departureAt: departureIso ?? undefined,
      returnAt: tripType === 'round_trip' ? returnIso ?? undefined : undefined,
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
      achInstructions: emailProps.achInstructions,
      zelleInstructions: emailProps.zelleInstructions,
      cardInstructions: emailProps.cardInstructions,
      cardPaymentLink: emailProps.cardPaymentLink,
      emailMessageId: emailResult.id,
      sentTo: toEmail,
    })

    if (!storeResult.ok) {
      warnings.push(`invoice not stored: ${storeResult.error}`)
    }

    revalidatePath('/manager/receipts')

    return {
      ok: true,
      email: { sent: true },
      reference: invoiceNumber,
      invoiceId: storeResult.ok ? storeResult.id : undefined,
      warning: warnings.length ? `Invoice emailed — ${warnings.join('; ')}` : undefined,
    }
  } catch (e) {
    console.error('[receipt] sendVendorInvoice error:', e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Send invoice failed',
    }
  }
}

type InsertInvoiceInput = {
  invoiceNumber: string
  vendorId?: string
  vendorName: string
  vendorCompany?: string
  vendorEmail: string
  vendorPhone?: string
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  invoiceDate: string
  dueDate?: string | null
  tripType?: InvoiceTripType
  durationHours?: number
  origin?: string
  destination?: string
  departureAt?: string
  returnAt?: string
  bookingTicketNumber?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  taxLabel?: string
  taxAmount: number
  discountAmount: number
  otherFees: number
  otherFeesLabel?: string
  amountDue: number
  notes?: string
  acceptedMethods: InvoicePaymentMethod[]
  achInstructions?: string
  zelleInstructions?: string
  cardInstructions?: string
  cardPaymentLink?: string
  emailMessageId?: string
  sentTo: string
}

async function insertInvoiceRecord(
  input: InsertInvoiceInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = await staffDb()
    const dueDateOnly =
      input.dueDate != null
        ? (() => {
            const d = new Date(input.dueDate)
            if (Number.isNaN(d.getTime())) return null
            return d.toISOString().slice(0, 10)
          })()
        : null

    const row = {
      invoice_number: input.invoiceNumber,
      vendor_id: input.vendorId || null,
      vendor_name: input.vendorName,
      vendor_company: input.vendorCompany || null,
      vendor_email: input.vendorEmail,
      vendor_phone: input.vendorPhone || null,
      company_name: input.companyName,
      company_address: input.companyAddress || null,
      company_phone: input.companyPhone || null,
      company_email: input.companyEmail || null,
      company_website: input.companyWebsite || null,
      invoice_date: input.invoiceDate,
      due_date: dueDateOnly,
      trip_type: input.tripType || null,
      duration_hours: input.durationHours ?? null,
      origin: input.origin || null,
      destination: input.destination || null,
      departure_at: input.departureAt || null,
      return_at: input.returnAt || null,
      booking_ticket_number: input.bookingTicketNumber || null,
      items: input.items,
      subtotal: input.subtotal,
      tax_label: input.taxLabel || null,
      tax_amount: input.taxAmount,
      discount_amount: input.discountAmount,
      other_fees: input.otherFees,
      other_fees_label: input.otherFeesLabel || null,
      amount_due: input.amountDue,
      notes: input.notes || null,
      accepted_methods: input.acceptedMethods,
      ach_instructions: input.achInstructions || null,
      zelle_instructions: input.zelleInstructions || null,
      card_instructions: input.cardInstructions || null,
      card_payment_link: input.cardPaymentLink || null,
      email_message_id: input.emailMessageId || null,
      sent_to: input.sentTo,
      sent_at: new Date().toISOString(),
      status: 'sent' as const,
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert(row)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.message?.includes('invoices') && error.message?.includes('does not exist')) {
        return {
          ok: false,
          error: 'Invoices table is missing. Run migration 20260721_invoices.sql in Supabase.',
        }
      }
      if (error.code === '23505') {
        return {
          ok: false,
          error: `Invoice number ${input.invoiceNumber} already exists in storage.`,
        }
      }
      return { ok: false, error: error.message }
    }
    if (!data?.id) return { ok: false, error: 'Invoice insert returned no id.' }
    return { ok: true, id: data.id as string }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not store invoice' }
  }
}

/**
 * Re-email a previously stored invoice (same content) to the original or a new address.
 */
export async function resendStoredInvoice(
  invoiceId: string,
  overrideEmail?: string,
): Promise<SendReceiptResult> {
  try {
    await assertStaff()

    if (!isMailConfigured()) {
      return {
        ok: false,
        error: getMailSetupHint() ?? 'Email is not configured (RESEND_API_KEY missing).',
      }
    }

    const supabase = await staffDb()
    const { data: row, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle()

    if (error) {
      return { ok: false, error: `Could not load invoice: ${error.message}` }
    }
    if (!row) return { ok: false, error: 'Invoice not found.' }
    if (row.status === 'void') {
      return { ok: false, error: 'This invoice is voided and cannot be resent.' }
    }

    const toEmail = (overrideEmail?.trim() || row.sent_to || row.vendor_email || '').trim()
    if (!toEmail) return { ok: false, error: 'No recipient email on this invoice.' }

    const rawItems: unknown[] = Array.isArray(row.items) ? row.items : []
    type ResendLine = {
      description: string
      quantity: number
      unitPrice: number
      lineTotal: number
    }
    const items: ResendLine[] = []
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue
      const it = raw as Record<string, unknown>
      const description = String(it.description ?? '').trim()
      const quantity = Number(it.quantity)
      const unitPrice = Number(it.unitPrice ?? it.unit_price)
      const lineTotal = Number(it.lineTotal ?? it.line_total)
      if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) continue
      items.push({
        description,
        quantity,
        unitPrice,
        lineTotal: Number.isFinite(lineTotal)
          ? lineTotal
          : Math.round(quantity * unitPrice * 100) / 100,
      })
    }

    if (items.length === 0) {
      return { ok: false, error: 'Stored invoice has no line items.' }
    }

    const rawMethods: unknown[] = Array.isArray(row.accepted_methods)
      ? row.accepted_methods
      : []
    const methods = rawMethods.filter(
      (m): m is InvoicePaymentMethod =>
        typeof m === 'string' && VALID_INVOICE_METHODS.has(m as InvoicePaymentMethod),
    )

    const tripType =
      row.trip_type === 'one_way' ||
      row.trip_type === 'round_trip' ||
      row.trip_type === 'charter'
        ? (row.trip_type as InvoiceTripType)
        : undefined

    const emailProps: VendorInvoiceEmailProps = {
      companyName: row.company_name || 'Imperial Odyssey, LLC',
      companyAddress: row.company_address || undefined,
      companyPhone: row.company_phone || undefined,
      companyEmail: row.company_email || undefined,
      companyWebsite: row.company_website || undefined,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date
        ? fmtDateTime(row.invoice_date)
        : fmtDateTime(new Date().toISOString()),
      dueDate: row.due_date ? fmtDate(new Date(row.due_date).toISOString()) : undefined,
      tripType,
      durationHours:
        row.duration_hours != null && Number(row.duration_hours) > 0
          ? Number(row.duration_hours)
          : undefined,
      vendorName: row.vendor_name,
      vendorCompany: row.vendor_company || undefined,
      vendorEmail: toEmail,
      vendorPhone: row.vendor_phone || undefined,
      origin: row.origin || undefined,
      destination: row.destination || undefined,
      departureDateTime: row.departure_at ? fmtDateTime(row.departure_at) : undefined,
      returnDateTime: row.return_at ? fmtDateTime(row.return_at) : undefined,
      bookingTicketNumber: row.booking_ticket_number || undefined,
      items,
      subtotal: Number(row.subtotal),
      taxLabel: row.tax_label || undefined,
      taxAmount: Number(row.tax_amount ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      otherFees: Number(row.other_fees ?? 0),
      otherFeesLabel: row.other_fees_label || 'Other fees',
      amountDue: Number(row.amount_due),
      notes: row.notes || undefined,
      acceptedMethods: methods.length ? methods : (['ach'] as InvoicePaymentMethod[]),
      achInstructions: row.ach_instructions || undefined,
      zelleInstructions: row.zelle_instructions || undefined,
      cardInstructions: row.card_instructions || undefined,
      cardPaymentLink: row.card_payment_link || undefined,
    }

    const emailResult = await sendVendorInvoiceEmail(toEmail, emailProps)
    if (!emailResult.sent) {
      return {
        ok: false,
        error: `Resend failed (email: ${emailResult.reason ?? 'failed'})`,
      }
    }

    // Touch sent_at / message id so the list reflects latest delivery.
    await supabase
      .from('invoices')
      .update({
        sent_at: new Date().toISOString(),
        sent_to: toEmail,
        email_message_id: emailResult.id || row.email_message_id,
      })
      .eq('id', invoiceId)

    revalidatePath('/manager/receipts')

    return {
      ok: true,
      email: { sent: true },
      reference: row.invoice_number,
      invoiceId,
    }
  } catch (e) {
    console.error('[receipt] resendStoredInvoice error:', e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Resend invoice failed',
    }
  }
}

type VendorUpsertInput = {
  id?: string
  name: string
  company?: string
  email: string
  phone?: string
  notes?: string
}

async function upsertVendorRecord(
  input: VendorUpsertInput,
): Promise<VendorActionResult> {
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Vendor name is required.' }
  if (!email) return { ok: false, error: 'Vendor email is required.' }

  try {
    const supabase = await staffDb()
    const payload = {
      name,
      company: input.company?.trim() || null,
      email,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { data, error } = await supabase
        .from('vendors')
        .update(payload)
        .eq('id', input.id)
        .select('id, name, company, email, phone')
        .maybeSingle()

      if (error) {
        // Unique email conflict when editing
        if (error.code === '23505') {
          return { ok: false, error: 'Another vendor already uses that email.' }
        }
        return { ok: false, error: error.message }
      }
      if (!data) return { ok: false, error: 'Vendor not found.' }
      return { ok: true, vendor: data }
    }

    // Insert new, or update existing row with same email (case-insensitive).
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('vendors')
        .update(payload)
        .eq('id', existing.id)
        .select('id, name, company, email, phone')
        .maybeSingle()
      if (error) return { ok: false, error: error.message }
      return { ok: true, vendor: data ?? undefined }
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert(payload)
      .select('id, name, company, email, phone')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'A vendor with that email already exists.' }
      }
      // Table missing — migration not applied
      if (error.message?.includes('vendors') && error.message?.includes('does not exist')) {
        return {
          ok: false,
          error: 'Vendors table is missing. Run migration 20260720_vendors.sql in Supabase.',
        }
      }
      return { ok: false, error: error.message }
    }

    return { ok: true, vendor: data ?? undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save vendor' }
  }
}

/** Create or update a saved vendor (for the invoice dropdown). */
export async function saveVendor(input: {
  id?: string
  name: string
  company?: string
  email: string
  phone?: string
  notes?: string
}): Promise<VendorActionResult> {
  try {
    await assertStaff()
    const result = await upsertVendorRecord(input)
    if (result.ok) {
      revalidatePath('/manager/receipts')
    }
    return result
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save vendor failed' }
  }
}

/** Delete a saved vendor from the directory. */
export async function deleteVendor(id: string): Promise<VendorActionResult> {
  try {
    await assertStaff()
    if (!id?.trim()) return { ok: false, error: 'Vendor id is required.' }

    const supabase = await staffDb()
    const { error } = await supabase.from('vendors').delete().eq('id', id.trim())
    if (error) return { ok: false, error: error.message }

    revalidatePath('/manager/receipts')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete vendor failed' }
  }
}
