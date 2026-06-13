// Browser Stripe.js loader (singleton). Safe for client components — uses the
// PUBLISHABLE key only (NEXT_PUBLIC_*). Never import the server client here.
'use client'

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let _promise: Promise<Stripe | null> | null = null

export function getStripePromise(): Promise<Stripe | null> {
  if (!_promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    _promise = key
      ? loadStripe(key, {
          developerTools: {
            assistant: {
              enabled: false,   // ← This hides the "For developers" badge
            },
          },
        })
      : Promise.resolve(null)
  }

  return _promise
}