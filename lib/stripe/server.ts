// lib/stripe/server.ts
import Stripe from 'stripe';

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY environment variable.');
  }
  return new Stripe(key, {
    apiVersion: '2024-11-20.acacia', // Pinned recent stable version (update deliberately when needed)
  });
}