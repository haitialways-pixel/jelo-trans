/**
 * Server-only Stripe client. NEVER import this from a client component.
 *
 * Instantiated lazily so a missing STRIPE_SECRET_KEY never crashes the app at
 * import/build time — it only throws if a payment is actually attempted without
 * configuration. Mirrors how the email module degrades gracefully.
 */
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}
