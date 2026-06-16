# Phalo Transportation — Project Handoff & Status

**For:** ownership / management · **Date:** 2026-06-03
One page: what works, what's left, and the decisions we need from you.

---

## ✅ What works today (verified live)

- **Booking, end to end** — choose trip + vehicle, price is computed on our server (never by the customer), confirmation sent by email.
- **Manage Booking** — a customer can look up or cancel using their booking number + phone.
- **One source of truth for the fleet** — vehicles, prices and photos come from the database and show **identically** on every page (home, fleet, booking). No more mismatched prices.
- **Security** — customers can't tamper with prices or read other people's bookings; standard security headers on every page.
- **Clean, documented codebase** — dead files removed, README accurate.

## 🟡 What we need from you (decisions & action items)

| # | What | Where |
|---|---|---|
| 1 | **Payments** — pick a model (full / authorization hold / save-card-charge-later), then send us Stripe **test** keys | `docs/PAYMENTS.md` |
| 2 | **Pricing** — approve the cost-based formula and fill in your real costs | `docs/PRICING_PROPOSAL.md` |
| 3 | **Assistant knowledge** — tick the quick policy sheet (~15 min) so the assistant answers in *your* words | `docs/CHATBOT_QUESTIONNAIRE.md` |
| 4 | **Email** — add your Resend API key and verified sender address so customer confirmations can be sent reliably | `.env.example` |
| 5 | **Assistant approach** — it's built & live; approve as-is, or request the optional neural-engine upgrade | see below |

## 🔧 In progress / pending a decision

- **Online payments** — Stripe groundwork is in place; the charge flow is **not built yet** (awaits decision #1).
- **Assistant (no AI/LLM cost)** — BUILT and live on the site. It answers questions and does safe look-ups (fleet, prices, availability, booking status) straight from the database, and can **never** create a booking or a refund — those route to a human (our phone) and are logged in a management queue. A lightweight matching engine runs today at zero cost; an optional upgrade to neural embeddings drops into the same interface later.
  - **Management alerts (cost note):** escalations are always saved to the database queue (free). A real-time push is wired but OFF by default — when you want one, prefer a **Telegram bot (free + instant)** over email. We reserve paid email (Resend) for customer-facing confirmations, to keep API/email costs down.
- **Visibility (SEO)**, brute-force rate-limiting, and a couple of content items (a real Mercedes S-Class photo; the service-page prices).

## 🚀 To run / deploy

- **Stack:** Next.js 16 + Supabase (the database is already hosted). **Recommended host: Vercel.**
- Copy `.env.example` → `.env.local`, fill in the keys, then `npm install` and `npm run dev`.
- **Going live** ≈ set the same env vars on Vercel + point the domain. ~30 minutes when approved.

## 📁 Where things live

- `docs/PAYMENTS.md` — payment model options
- `docs/PRICING_PROPOSAL.md` — pricing formula proposal (with cover note)
- `docs/CHATBOT_QUESTIONNAIRE.md` — quick tick-box policy sheet for the assistant (~15 min to fill)
- `docs/HANDOFF.md` — this file
- `.env.example` — every key/secret the app needs (none are committed)
- `supabase/schema.sql` — the full database definition (tables, security, functions)

> Nothing here is published yet. The code lives on the `production-hardening` branch; a single push puts it online when you give the go-ahead.
