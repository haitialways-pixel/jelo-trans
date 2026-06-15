// lib/stripe/server.ts
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function isStripeConfigured(): boolean {
  return !!stripeSecretKey;
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY environment variable.');
  }
  return new Stripe(stripeSecretKey!, {
    apiVersion: '2026-05-27.dahlia',   // Current version in your environment
  });
}

// You may already have this:
export const createClient = () => {
  // ... existing code if any
};