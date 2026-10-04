// Stripe payment helpers — SERVER ONLY.
//
// Two charges per booking:
//   1) deposit  — 25% processed after staff confirmation (not at booking)
//   2) balance  — the remainder charged off-session when the ride is completed
//
// All amounts are computed SERVER-SIDE from the reservation's authoritative total_price.
// We store only Stripe IDs on the reservation (never card data).
import { getStripe, isStripeConfigured } from './server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { recordOpsNotification } from '@/lib/manager/notifyOps'
import { BRAND_NAME, CANCEL_REFUND_HOURS } from '@/lib/site'
import { DEPOSIT_RATE } from '@/lib/payments/summary'

export { DEPOSIT_RATE }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type DepositResult = {
  clientSecret: string
  depositAmount: number
  balanceAmount: number
}

/**
 * Creates (or reuses) a Stripe Customer and a deposit PaymentIntent for 25% of the
 * reservation total, saving the card for the later balance charge. Returns the
 * client secret for Stripe Elements to confirm on the client.
 */
export async function createDepositForBooking(bookingNumber: string): Promise<DepositResult> {
  const stripe = getStripe()
  const admin = createAdminClient()

  const { data: r, error } = await admin
    .from('reservations')
    .select('id, customer_name, customer_email, total_price, stripe_customer_id, deposit_intent_id, deposit_paid_at')
    .eq('booking_number', bookingNumber)
    .single()
  if (error || !r) throw new Error('Reservation not found')

  const total = Number(r.total_price)
  const depositAmount = round2(total * DEPOSIT_RATE)
  const balanceAmount = round2(total - depositAmount)

  if (depositAmount < 0.5) {
    throw new Error(`Computed deposit (25%) is too small ($${depositAmount.toFixed(2)}) for a ${total.toFixed(2)} booking. Check fleet minimum_price or distance.`)
  }

  if (r.deposit_paid_at) {
    throw new Error('Deposit already paid')
  }

  if (r.deposit_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(r.deposit_intent_id as string)
    const expectedCents = Math.round(depositAmount * 100)
    const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(existing.status)
    if (existing.status === 'succeeded') {
      throw new Error('Deposit already paid')
    }
    if (reusable && existing.amount === expectedCents && existing.client_secret) {
      return { clientSecret: existing.client_secret, depositAmount, balanceAmount }
    }
  }

  // Reuse an existing customer if this booking already has one.
  let customerId: string = r.stripe_customer_id as string
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: r.customer_name,
      email: r.customer_email,
      metadata: { booking_number: bookingNumber },
    })
    customerId = customer.id
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(depositAmount * 100),
    currency: 'usd',
    customer: customerId,
    setup_future_usage: 'off_session', // save the card to charge the balance later
    receipt_email: r.customer_email, // Stripe emails the official receipt (live mode)
    description: `${BRAND_NAME} deposit — ${bookingNumber}`,
    metadata: { kind: 'deposit', reservation_id: r.id, booking_number: bookingNumber },
    payment_method_types: ['card'], // card only → enables off-session balance charge, no redirect
  })

  await admin
    .from('reservations')
    .update({
      stripe_customer_id: customerId,
      deposit_intent_id: intent.id,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
    })
    .eq('id', r.id)

  if (!intent.client_secret) throw new Error('Stripe did not return a client secret')
  return { clientSecret: intent.client_secret, depositAmount, balanceAmount }
}

export type BalanceResult = { ok: boolean; reason?: string }

function expectedDeposit(totalPrice: number): { depositAmount: number; balanceAmount: number } {
  const total = round2(Number(totalPrice) || 0)
  const depositAmount = round2(total * DEPOSIT_RATE)
  const balanceAmount = round2(total - depositAmount)
  return { depositAmount, balanceAmount }
}

/**
 * Store the 25% deposit amount without collecting it. Does not mark the deposit paid.
 */
export async function scheduleDepositAmounts(reservationId: string): Promise<void> {
  if (!isAdminConfigured()) return
  const admin = createAdminClient()
  const { data: r } = await admin
    .from('reservations')
    .select('id, total_price, deposit_amount, deposit_paid_at')
    .eq('id', reservationId)
    .maybeSingle()
  if (!r || r.deposit_paid_at) return
  if (Number(r.deposit_amount ?? 0) > 0) return
  const { depositAmount, balanceAmount } = expectedDeposit(Number(r.total_price))
  if (depositAmount < 0.5) return
  await admin
    .from('reservations')
    .update({
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', r.id)
}

/**
 * Charges the 25% deposit off-session on the saved card (same flow as chargeBalance).
 * Does not mark the deposit paid unless Stripe reports success.
 */
export async function chargeDeposit(reservationId: string): Promise<BalanceResult> {
  try {
    if (!isStripeConfigured()) {
      return { ok: false, reason: 'Stripe is not configured, so the 25% deposit cannot be charged.' }
    }
    if (!isAdminConfigured()) {
      return {
        ok: false,
        reason: 'Database service role is not available, so the 25% deposit cannot be charged.',
      }
    }

    const stripe = getStripe()
    const admin = createAdminClient()
    const { data: r, error } = await admin
      .from('reservations')
      .select(
        'id, booking_number, customer_email, total_price, stripe_customer_id, stripe_payment_method_id, deposit_amount, deposit_paid_at, payment_status',
      )
      .eq('id', reservationId)
      .single()
    if (error || !r) return { ok: false, reason: 'reservation not found' }
    if (r.deposit_paid_at) return { ok: true }

    const { depositAmount, balanceAmount } = expectedDeposit(Number(r.total_price))
    if (depositAmount < 0.5) {
      return {
        ok: false,
        reason: `Computed deposit (25%) is too small ($${depositAmount.toFixed(2)}).`,
      }
    }

    if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
      return {
        ok: false,
        reason:
          'No card on file. Charge now needs a saved card. Use Process later, then charge the 25% deposit from the reservation after a card is saved.',
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(depositAmount * 100),
      currency: 'usd',
      customer: r.stripe_customer_id as string,
      payment_method: r.stripe_payment_method_id as string,
      off_session: true,
      confirm: true,
      receipt_email: r.customer_email as string,
      description: `${BRAND_NAME} deposit — ${r.booking_number}`,
      metadata: { kind: 'deposit', reservation_id: r.id, booking_number: r.booking_number },
    })

    const patch: Record<string, unknown> = {
      deposit_intent_id: intent.id,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      updated_at: new Date().toISOString(),
    }
    if (intent.status === 'succeeded') {
      patch.deposit_paid_at = new Date().toISOString()
      patch.payment_status = 'partial'
    }
    await admin.from('reservations').update(patch).eq('id', r.id)

    if (intent.status !== 'succeeded') {
      return {
        ok: false,
        reason: `Deposit charge did not succeed (Stripe status: ${intent.status}). The deposit was not marked paid.`,
      }
    }

    await recordOpsNotification({
      kind: 'deposit_paid',
      title: '✅ Deposit collected · ' + r.booking_number,
      body: '$' + depositAmount.toFixed(2) + ' charged on file',
      reservationId: r.id,
      severity: 'info',
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'deposit charge failed' }
  }
}

/**
 * Charges the remaining balance off-session on the card saved at booking.
 * Idempotent: a no-op if already paid. Called when a ride is marked completed.
 * The Stripe webhook flips payment_status to 'paid' on success.
 */
export async function chargeBalance(reservationId: string): Promise<BalanceResult> {
  const stripe = getStripe()
  const admin = createAdminClient()

  const { data: r, error } = await admin
    .from('reservations')
    .select('id, booking_number, customer_email, stripe_customer_id, stripe_payment_method_id, balance_amount, balance_paid_at')
    .eq('id', reservationId)
    .single()
  if (error || !r) return { ok: false, reason: 'reservation not found' }
  if (r.balance_paid_at) return { ok: true } // already charged
  if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
    return {
      ok: false,
      reason: 'No card on file. The customer must pay the 25% deposit and save a card before this ride can be completed.',
    }
  }

  const cents = Math.round(Number(r.balance_amount ?? 0) * 100)
  if (cents <= 0) return { ok: true }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      customer: r.stripe_customer_id as string,
      payment_method: r.stripe_payment_method_id as string,
      off_session: true,
      confirm: true,
      receipt_email: r.customer_email as string,
      description: `${BRAND_NAME} balance — ${r.booking_number}`,
      metadata: { kind: 'balance', reservation_id: r.id, booking_number: r.booking_number },
    })
    // Mark paid immediately on synchronous success (off-session confirm returns the result).
    // The webhook remains a backstop in production and is idempotent.
    const patch: Record<string, unknown> = { balance_intent_id: intent.id }
    if (intent.status === 'succeeded') {
      patch.balance_paid_at = new Date().toISOString()
      patch.payment_status = 'paid'
    }
    await admin.from('reservations').update(patch).eq('id', r.id)

    if (intent.status !== 'succeeded') {
      return {
        ok: false,
        reason: `Balance charge did not succeed (Stripe status: ${intent.status}). The ride was not marked paid.`,
      }
    }

    // Ring the manager bell.
    if (intent.status === 'succeeded') {
      await recordOpsNotification({
        kind: 'balance_paid',
        title: '✅ Balance settled · ' + r.booking_number,
        body: '$' + (cents / 100).toFixed(2) + ' charged on file',
        reservationId: r.id,
        severity: 'info',
      })
    }
    return { ok: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'balance charge failed'
    await recordOpsNotification({
      kind: 'balance_failed',
      title: '⚠️ Balance charge failed · ' + r.booking_number,
      body: reason.slice(0, 200),
      reservationId: r.id,
      severity: 'critical',
    })
    // Off-session charges can fail (card declined, expired, needs authentication).
    return { ok: false, reason }
  }
}


export type DepositRefundResult =
  | { outcome: 'not_collected' }
  | { outcome: 'kept'; message: string }
  | { outcome: 'refunded'; message: string; amount: number }
  | { outcome: 'error'; message: string }

/**
 * Refund a collected 25% deposit when cancellation is at least 24 hours before pickup.
 * Inside 24 hours the deposit is kept. Does not pretend a refund happened.
 */
export async function refundCollectedDeposit(
  reservationId: string,
  hint?: { depositPaidAt?: string | null },
): Promise<DepositRefundResult> {
  if (!isAdminConfigured()) {
    if (!hint?.depositPaidAt) return { outcome: 'not_collected' }
    return {
      outcome: 'error',
      message: 'The reservation is cancelled, but the deposit was NOT refunded: the database service role is not configured.',
    }
  }
  const admin = createAdminClient()
  const { data: r, error } = await admin
    .from('reservations')
    .select('id, booking_number, deposit_amount, deposit_intent_id, deposit_paid_at, pickup_time, payment_status')
    .eq('id', reservationId)
    .single()
  if (error || !r) {
    return { outcome: 'error', message: 'Could not load the reservation to decide the deposit refund.' }
  }
  const paid = Boolean(r.deposit_paid_at) && Number(r.deposit_amount ?? 0) > 0
  if (!paid || r.payment_status === 'refunded') {
    return { outcome: 'not_collected' }
  }
  const pickupMs = new Date(r.pickup_time as string).getTime()
  const hoursUntil = (pickupMs - Date.now()) / 36e5
  const amount = round2(Number(r.deposit_amount))
  if (!Number.isFinite(hoursUntil) || hoursUntil < CANCEL_REFUND_HOURS) {
    return {
      outcome: 'kept',
      message: `The 25% deposit ($${amount.toFixed(2)}) is kept because this cancellation is inside ${CANCEL_REFUND_HOURS} hours of pickup.`,
    }
  }
  if (!isStripeConfigured()) {
    return {
      outcome: 'error',
      message: 'The reservation is cancelled, but the deposit was NOT refunded: Stripe is not configured.',
    }
  }
  if (!r.deposit_intent_id) {
    return {
      outcome: 'error',
      message: 'The reservation is cancelled, but the deposit was NOT refunded: no Stripe payment id is stored.',
    }
  }
  try {
    const stripe = getStripe()
    await stripe.refunds.create({
      payment_intent: r.deposit_intent_id as string,
      amount: Math.round(amount * 100),
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Stripe refund failed'
    if (!/already been refunded/i.test(reason)) {
      return {
        outcome: 'error',
        message: `The reservation is cancelled, but the deposit was NOT refunded: ${reason}`,
      }
    }
  }
  await admin.from('reservations').update({ payment_status: 'refunded' }).eq('id', r.id)
  return {
    outcome: 'refunded',
    amount,
    message: `The 25% deposit of $${amount.toFixed(2)} was refunded (cancelled at least ${CANCEL_REFUND_HOURS} hours before pickup).`,
  }
}
