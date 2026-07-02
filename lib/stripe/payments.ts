// Stripe payment helpers — SERVER ONLY.
//
// Two charges per booking:
//   1) deposit  — 10% taken on-session at booking; the card is saved (setup_future_usage)
//   2) balance  — the remainder charged off-session when the ride is completed
//
// All amounts are computed SERVER-SIDE from the reservation's authoritative total_price.
// We store only Stripe IDs on the reservation (never card data).
import { getStripe } from './server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordOpsNotification } from '@/lib/manager/notifyOps'

export const DEPOSIT_RATE = 0.1

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type DepositResult = {
  clientSecret: string
  depositAmount: number
  balanceAmount: number
}

/**
 * Creates (or reuses) a Stripe Customer and a deposit PaymentIntent for 10% of the
 * reservation total, saving the card for the later balance charge. Returns the
 * client secret for Stripe Elements to confirm on the client.
 */
export async function createDepositForBooking(bookingNumber: string): Promise<DepositResult> {
  const stripe = getStripe()
  const admin = createAdminClient()

  const { data: r, error } = await admin
    .from('reservations')
    .select('id, customer_name, customer_email, total_price, stripe_customer_id, deposit_intent_id')
    .eq('booking_number', bookingNumber)
    .single()
  if (error || !r) throw new Error('Reservation not found')

  const total = Number(r.total_price)
  const depositAmount = round2(total * DEPOSIT_RATE)
  const balanceAmount = round2(total - depositAmount)

  if (depositAmount < 0.5) {
    throw new Error(`Computed deposit (10%) is too small ($${depositAmount.toFixed(2)}) for a ${total.toFixed(2)} booking. Check fleet minimum_price or distance.`)
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
    description: `Imperial Odyssey deposit — ${bookingNumber}`,
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
    return { ok: false, reason: 'no saved card on file' }
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
      description: `Imperial Odyssey balance — ${r.booking_number}`,
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
