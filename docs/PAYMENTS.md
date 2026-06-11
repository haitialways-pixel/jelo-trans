# Payments (Stripe) — setup status & decision needed

This documents what is **ready** for online payments and the **one decision** the business
owner needs to make before we build the charge flow.

## What is already in place

- `stripe` SDK installed (v22.2.0).
- `lib/stripe/server.ts` — server-only Stripe client, created lazily (a missing key never
  crashes the app; it only throws if a payment is actually attempted).
- Env placeholders in `.env.example` / `.env.local`:
  `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `payments` table already exists in the database (amount, transaction_id, status…).
- Reservations already carry `payment_status` (`unpaid` / `paid` / `refunded` / `partial`).

**Not built yet:** the checkout/charge flow + the webhook. Those depend on the decision below.

## Non-negotiable security rules (any model)

These are how we avoid the classic payment bugs:

1. **The amount is computed server-side** from the reservation (`total_price`), never sent by
   the client. The client only passes a booking identifier.
2. **A booking is marked "paid" ONLY from the signed Stripe webhook**, never from the browser
   redirect (`success_url`) — otherwise anyone can open the success URL without paying.
3. **The webhook verifies Stripe's signature on the RAW request body** (`STRIPE_WEBHOOK_SECRET`).
4. **Webhook handling is idempotent** (keyed on the Stripe payment id) — Stripe can deliver the
   same event more than once.
5. **The customer's card never touches our servers.** With Stripe Checkout (hosted) or the
   embedded Payment Element, card data goes straight to Stripe. We are PCI **SAQ A** (lightest).

## The decision: which payment model?

| Model | We touch the card? | Avoids refunds? | Main limitation |
| --- | --- | --- | --- |
| **A. Full payment at booking** | No | No — a cancellation becomes a refund (Stripe fees not returned) | Simplest to build |
| **B. Authorization hold → capture** | No | Yes, before capture (releasing a hold is **not** a refund) | A hold **expires after ~7 days** — only works if the ride is within ~7 days of booking |
| **C. Save card now → charge near the ride** | No | Yes — a cancellation means we simply never charge | The tokenized card is stored **at Stripe** (never with us) until we charge |

Notes for advance bookings (the typical limo case, days/weeks ahead):
- Model **B** does **not** fit rides booked more than ~7 days out (the authorization expires).
- Model **C** fits advance bookings and avoids refunds, at the cost of Stripe holding a card
  token until the charge. We never see or store the card either way.

### How to choose
Pick **A**, **B**, or **C** and tell the developer. Then provide Stripe **test** keys
(`sk_test_…`, `pk_test_…`) and we wire the flow + webhook and test end-to-end before going live.

> Decision: _______________________  (A / B / C)   — by: ____________  date: __________
