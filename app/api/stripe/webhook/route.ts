// Stripe webhook — SERVER ONLY, Node runtime (needs raw body + Stripe SDK).
//
// Security: every request is verified against STRIPE_WEBHOOK_SECRET (rejects forged
// calls). Idempotent: each event id is recorded once in stripe_events, so Stripe's
// retries/duplicates are no-ops. Writes use the service-role client (no user session).
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { notifyManagement } from '@/lib/chatbot/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !isStripeConfigured() || !isAdminConfigured()) {
    return new Response('Stripe webhook not configured', { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  const raw = await req.text() // RAW body — required for signature verification

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig ?? '', secret)
  } catch (e) {
    return new Response(`Invalid signature: ${e instanceof Error ? e.message : 'error'}`, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: first writer wins. A PK conflict means we've already handled this event.
  const { error: dupeError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
  if (dupeError) {
    return new Response('ok (already processed)', { status: 200 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      const reservationId = pi.metadata?.reservation_id
      const kind = pi.metadata?.kind
      if (reservationId && kind === 'deposit') {
        const pmId = typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method?.id ?? null)
        await admin
          .from('reservations')
          .update({
            deposit_paid_at: new Date().toISOString(),
            payment_status: 'partial',
            stripe_payment_method_id: pmId,
          })
          .eq('id', reservationId)
      } else if (reservationId && kind === 'balance') {
        await admin
          .from('reservations')
          .update({ balance_paid_at: new Date().toISOString(), payment_status: 'paid' })
          .eq('id', reservationId)
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent
      if (pi.metadata?.kind === 'balance') {
        await notifyManagement({
          title: '⚠️ Balance charge failed',
          message:
            `Booking ${pi.metadata?.booking_number ?? pi.metadata?.reservation_id}: ` +
            `${pi.last_payment_error?.message ?? 'card declined'}. Please follow up with the customer.`,
        })
      }
    }
  } catch (e) {
    // Don't 500 on a handler error after we've recorded the event — log and ack so Stripe
    // doesn't hammer retries; a failed DB update is surfaced via monitoring.
    console.error('stripe webhook handler error:', e instanceof Error ? e.message : e)
  }

  return new Response('ok', { status: 200 })
}
