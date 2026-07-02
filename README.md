# Imperial Odyssey — Public Customer Website

Luxury limousine and chauffeur service website for Imperial Odyssey, LLC (Orlando, Florida).

> 👋 **Reviewing this project? START HERE → [`docs/HANDOFF.md`](docs/HANDOFF.md)** — what works today, what we need from you (payments, pricing, the assistant questionnaire, email), and how to go live.

## Current Status

A working foundation (Next.js 16 + React 19 + Supabase), actively being hardened:

- Luxurious dark + gold design
- Marketing pages (Home, Fleet, Services, About, Contact)
- **Booking** system — multi-step, **server-side pricing**, DB-backed fleet
- **Manage Booking** — view + cancel via booking number + phone
- Supabase schema with RLS + guest-access RPCs (server-authoritative price, atomic availability)
- Confirmation emails via Resend (set `RESEND_API_KEY` to enable)
- Real photography in `public/images/`

**Not yet done:** online payments (Stripe groundwork in place — see `docs/PAYMENTS.md`),
rate-limiting on guest lookups, and single-source fleet on the marketing pages.

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add your Supabase credentials
npm run dev
```

Visit:
- http://localhost:3000
- http://localhost:3000/book
- http://localhost:3000/manage-booking

## Database Setup

1. Run `supabase/schema.sql` in your Supabase project
2. The schema includes:
   - `fleet`, `reservations`, `payments` tables
   - Full RLS policies
   - Guest functions (`get_reservation_by_booking`, `cancel_guest_reservation`, etc.)
   - Seed data with your real vehicle images

## What's Working

- Multi-step booking flow
- Vehicle selection with real photos
- Price calculation
- Reservation creation (saved to Supabase)
- Manage Booking (lookup + cancel using booking number + phone)

## What Still Needs Work (Lower Priority)

- Google Maps Autocomplete (structure is ready)
- Full Stripe checkout + webhooks
- Realtime live chat
- Automated emails (Resend)
- Admin portal (not in current scope)

## Images

All photography uses your original images from the `images/` folder. No AI-generated images were used.

## Tech Stack

- Next.js 15 (App Router)
- Supabase (PostgreSQL + RLS)
- TypeScript + Zod
- Tailwind + custom luxury design system

Built for Imperial Odyssey, LLC.
