# Phalo Transportation — Codebase Handoff

A luxury chauffeur booking platform built on Next.js 16 + Supabase + Stripe.
This codebase has been pre-branded for **Phalo Transportation** but every
configuration value (API keys, phone number, fleet photos) needs to be filled
in by your team before going live.

---

## What's in the box

| Area | Description |
|---|---|
| **Public site** | Home, fleet catalog, services, about, contact, booking, manage/cancel booking |
| **Booking flow** | 3-step wizard with Google Distance Matrix address autocomplete, server-computed pricing, Stripe Elements deposit payment |
| **Manager dashboard** | Invite-only authentication, reservation lifecycle (confirm → dispatched → arrived → onboard → completed), per-unit vehicle assignment, audit log of every staff write, fleet & chauffeur CRUD |
| **Payments** | 10% deposit at booking (Stripe Elements, card-only). Balance auto-charged off-session when the manager marks the ride completed. |
| **Emails** | Transactional emails via SMTP (nodemailer): booking confirmation, "chauffeur arrived", ride complete with itemized receipt |
| **Chatbot** | LLM-free concierge bot for FAQ + safe actions (fleet info, price estimates, booking lookup, escalation to a human) |
| **Security** | TLS, HSTS, CSP, X-Frame-Options, rate limiting (DB-backed) on public endpoints, RLS-protected database, signed Stripe webhooks, audited staff actions |

---

## Stack

- **Frontend & API**: Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript
- **Database & Auth**: Supabase (Postgres + RLS + Auth)
- **Payments**: Stripe (test or live keys)
- **Maps/distance**: Google Distance Matrix API
- **Email**: SMTP (Google Workspace, SES, Mailgun — any standard SMTP relay)
- **Notifications**: Telegram bot (optional) for ops alerts
- **Hosting**: Vercel (recommended; the code uses Node runtime + serverless)

---

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template and fill in real values
cp .env.example .env.local
# Then edit .env.local — see the next section.

# 3. Provision the database
# Run supabase/schema.sql on a fresh Supabase project (SQL Editor → paste → Run).
# This creates tables, RLS policies, RPCs, and seeds a 4-vehicle catalog you can edit.

# 4. Create your first manager account
# In Supabase Dashboard → Authentication → Add user → enter the manager email & password,
# then in the SQL Editor:
#   INSERT INTO public.staff (id, full_name, role)
#   VALUES ('<user-id-from-auth>', 'Phalo Manager', 'admin');

# 5. Launch
npm run dev
# Open http://localhost:3000
# Manager login at http://localhost:3000/manager
```

---

## Environment variables (`.env.local`)

| Variable | Required for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything | Same place (the public key — safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook, payments | Supabase Dashboard → Project Settings → API Keys → **Secret keys** (sb_secret_...). Server only — never expose to the browser. |
| `STRIPE_SECRET_KEY` | Payments | Stripe Dashboard → Developers → API keys (sk_test_... or sk_live_...) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments | Same place (pk_test_... / pk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Webhook (production) | Stripe Dashboard → Developers → Webhooks → Add endpoint → `<your-domain>/api/stripe/webhook` (whsec_...) |
| `GOOGLE_MAPS_API_KEY` | Distance & autocomplete | Google Cloud Console — enable Distance Matrix API + Places API |
| `RESEND_API_KEY` | Email | Resend Dashboard → API Keys |
| `BOOKING_FROM_EMAIL` | Email | The verified sender address for Resend |
| `SITE_URL` | Email links | Your public URL (e.g. `https://phalotransportation.com`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional | @BotFather on Telegram, then `/getUpdates` to find chat id |
| `MANAGEMENT_EMAIL` | Optional fallback | Recipient for ops alerts if Telegram isn't set |

⚠️ **Never commit `.env.local`** — it is gitignored and must remain on the server only.

---

## Deploying to Vercel

1. Push the repo to GitHub.
2. On Vercel, **Import Project** → select the repo. Next.js is auto-detected.
3. Add every variable from `.env.local` in **Project Settings → Environment Variables**.
4. Deploy. Vercel will assign a `<project>.vercel.app` URL.
5. Once you have the URL, go back to Stripe Dashboard → Webhooks → add an endpoint
   `https://<your-vercel-url>/api/stripe/webhook` → copy the `whsec_…` → set
   `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.

---

## Deploying to Cloudflare (Pages + Workers via open-next)

The repo also supports deployment to Cloudflare (see `npm run deploy` and `npm run preview`).

1. Make sure you have Wrangler CLI auth: `npx wrangler login`.
2. (Optional but recommended for local testing of edge routes) Create `.dev.vars` in project root (gitignored) with your **server-only** secrets, one per line:
   ```
   GOOGLE_MAPS_API_KEY=your_real_server_key_here
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=...
   RESEND_API_KEY=...
   ```
   (Plain `KEY=VALUE` format — no `export`, no quotes around most values.)
3. For production: In the Cloudflare Pages dashboard → your project → Settings → Environment variables (or use `wrangler pages secret put GOOGLE_MAPS_API_KEY` etc. for encrypted secrets).
   - Add **all** the server-only keys from the table above (no `NEXT_PUBLIC_` prefix for secrets).
   - Also add the public ones if used (`NEXT_PUBLIC_*` can be "Plaintext" or "Environment variable").
4. Run `npm run build && npx @opennextjs/cloudflare deploy` (or connect Git for continuous deploy).
5. After deploy, update any webhook URLs (Stripe, etc.) with the new `*.pages.dev` domain and set the corresponding secrets.

**Note on GOOGLE_MAPS_API_KEY**: This is the most common source of "Google Maps API key is missing on the server". It must be a **server-side** key (Places API + Distance Matrix API enabled). It is **not** the same as any `NEXT_PUBLIC_` key. Set it in the target platform's secret/env config, then redeploy.

---

## Things Phalo must customize before going live

- [ ] **Fleet photos** — replace files in `public/images/` (Suburban, Yukon XL, Expedition, Sprinter, Sedan). The current paths are placeholders.
- [ ] **Hero image** — `public/images/stitch-hero-night.jpg` is the homepage background.
- [ ] **Fleet pricing** — open `/manager/fleet` and edit base price, per-mile rate, and minimum per vehicle. (Or seed your own values in `supabase/schema.sql` before first run.)
- [ ] **About / contact / services copy** — `app/about/page.tsx`, `app/contact/page.tsx`, `app/services/page.tsx` carry the brand voice; rewrite to match Phalo's positioning.
- [ ] **Chatbot knowledge** — `lib/chatbot/knowledge.ts` contains the FAQ answers; update to reflect Phalo's policies.
- [ ] **Email copy** — `lib/email/sendBookingConfirmation.ts`, `sendChauffeurArrived.ts`, `sendRideComplete.ts` use a concierge voice; review and adjust.
- [ ] **Brand domain** — search and replace `phalotransportation.com` with the real domain once registered.

---

## Architecture highlights worth knowing

### Security model
- **Customers** are anonymous (no accounts) — they book as guests.
- **Staff** are invite-only (no public signup). The `public.staff` table is the authorization gate. `public.is_staff()` is the single predicate every RLS policy and SECURITY DEFINER RPC consults.
- **RLS**: anon can only call sanctioned RPCs (`create_reservation`, `get_reservation_by_booking`, `cancel_guest_reservation`, `update_guest_reservation`, `create_support_request`, `check_vehicle_availability`). Direct table reads/writes are blocked.
- **Rate limiting**: a single DB function `check_rate_limit(ip, action, max, window_sec)` is called from each public endpoint. See `lib/security/rateLimit.ts`.
- **Audit log**: every staff write goes through a SECURITY DEFINER RPC that records `who / what / when` into `public.audit_log`.
- **Secrets**: server-only env vars are never prefixed with `NEXT_PUBLIC_` and never make it to the browser bundle.

### Pricing model
- Each vehicle has `base_price` + `price_per_mile` + `minimum_price` in the `fleet` table.
- The server computes `total = max(base + distance × per_mile, minimum)` inside the `create_reservation` RPC. The client total is never trusted.
- **Gratuity is not added automatically** — it is arranged at payment time (or by the chauffeur in person).
- A **10% deposit** is charged at booking via Stripe Elements. The card is saved (`setup_future_usage: 'off_session'`).
- When the manager marks a ride **completed**, the balance is charged automatically on the saved card (no client interaction).

### Vehicle inventory
- `fleet` = customer-facing catalog (the bookable "models").
- `vehicle_units` = the physical cars in your inventory (e.g. three Ford Expeditions).
- Availability for a model = number of operational units. So if you have 3 Expeditions, you can have 3 simultaneous bookings of the "Luxury Sprinter Van" model. The manager assigns a specific unit to each booking.

---

## Repository map

```
app/                     # Next.js routes
  api/places/            # Distance Matrix + autocomplete proxies (server-side, rate-limited)
  api/stripe/webhook/    # Signed Stripe webhook
  book/                  # Customer booking flow (server actions)
  manage-booking/        # Guest lookup/cancel
  manager/(dash)/        # Manager dashboard (guarded by requireStaff)
  manager/login/         # Staff login
components/              # React components by domain (booking, manager, fleet, shared, chatbot)
lib/
  fleet.ts               # DB-backed fleet helpers (single source of truth)
  manager/               # Staff data access + server actions (rate-limited, audited)
  stripe/                # Server-side Stripe helpers (deposit creation, balance charge)
  email/                 # Transactional email templates (SMTP)
  security/rateLimit.ts  # DB-backed rate limiting helper
  chatbot/               # LLM-free retrieval bot + safe actions
supabase/schema.sql      # Complete schema with RLS + RPCs; idempotent.
public/images/           # Brand assets (replace with Phalo's photos)
docs/                    # Internal documentation
```

---

## Support

The code is self-contained and documented inline. Start with `supabase/schema.sql`
(the database is the source of truth) and `lib/fleet.ts` (the entry point used by
every page that needs vehicle data).

Good luck — Phalo Transportation is going to look great. 🚙
