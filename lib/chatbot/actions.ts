'use server'

import { createClient } from '@/lib/supabase/server'
import { getFleet, type Vehicle } from '@/lib/fleet'
import { calculatePrice } from '@/app/book/actions'
import { HUMAN_PHONE, type ChatAction, type ChatContext } from './knowledge'
import { notifyManagement } from './notify'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { extractBookingNumber } from '@/lib/bookingNumber'

type ActionResult = { text: string; link?: { href: string; label: string }; context?: ChatContext }

// Map common ways a customer names a vehicle to its exact fleet name. Compared on a compacted
// string (no spaces/punctuation) so "s-class", "s class" and "sclass" all match.
const VEHICLE_ALIASES: Record<string, string> = {
  suburban: '2023 Chevrolet Suburban',
  chevrolet: '2023 Chevrolet Suburban',
  chevy: '2023 Chevrolet Suburban',
  yukon: '2023 GMC Yukon XL',
  gmc: '2023 GMC Yukon XL',
  expedition: '2024 Ford Expedition',
  ford: '2024 Ford Expedition',
}

function matchVehicle(text: string, fleet: Vehicle[]): Vehicle | undefined {
  const compact = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  let bestName: string | undefined
  let bestLen = 0
  for (const [alias, name] of Object.entries(VEHICLE_ALIASES)) {
    if (compact.includes(alias) && alias.length > bestLen) {
      bestName = name
      bestLen = alias.length
    }
  }
  return bestName ? fleet.find((v) => v.name === bestName) : undefined
}

function extractHours(text: string): number | undefined {
  const m = text.match(/(\d{1,2})\s*(?:hours?|hrs?|h)\b/i)
  if (!m) return undefined
  return Math.min(Math.max(parseInt(m[1], 10), 1), 24)
}

/**
 * Runs ONE safe, read-only assistant action. There is no path here that creates a
 * reservation or a refund — sensitive intents land in `escalate`, which records the
 * request for management and hands the customer a human contact.
 */
export async function runChatAction(
  action: ChatAction,
  query: string,
  context: ChatContext = {},
): Promise<ActionResult> {
  switch (action) {
    case 'list_fleet': {
      const fleet = await getFleet()
      if (!fleet.length) {
        return { text: 'Our fleet is being updated — please check the Reserve page.', link: { href: '/book', label: 'Reserve' } }
      }
      const lines = fleet.map((v) => `• ${v.name} — seats ${v.capacity}, from $${Math.round(Number(v.base_price))} base + $${Number(v.price_per_mile)}/mile`)
      return {
        text: `Here’s our fleet:\n${lines.join('\n')}\n\nWant an estimate, or shall I help you reserve one?`,
        link: { href: '/book', label: 'Reserve a vehicle' },
      }
    }

    case 'estimate_price': {
      const fleet = await getFleet()
      const vehicle =
        matchVehicle(query, fleet) ??
        (context.vehicleId ? fleet.find((v) => v.id === context.vehicleId) : undefined)

      const ctx: ChatContext = {}
      if (vehicle) {
        ctx.vehicleId = vehicle.id
        ctx.vehicleName = vehicle.name
      }

      if (vehicle) {
        return {
          text: `The ${vehicle.name} is $${Math.round(Number(vehicle.base_price))} base plus $${Number(vehicle.price_per_mile)}/mile (gratuity arranged at payment). To get an exact quote, please use our booking estimator where you can enter your pickup and dropoff addresses.`,
          link: { href: '/book', label: 'Get an exact quote' },
          context: ctx,
        }
      }

      const lines = fleet.slice(0, 6).map((v) => `• ${v.name}: $${Math.round(Number(v.base_price))} base + $${Number(v.price_per_mile)}/mile`)
      return {
        text: `Here are the rates for our vehicles:\n${lines.join('\n')}\n\nTo get an exact price, please enter your pickup and dropoff addresses on our Reserve page.`,
        link: { href: '/book', label: 'Reserve page' },
      }
    }

    case 'check_availability': {
      return {
        text: `I can show live availability as you choose your date and time on the Reserve page — it confirms the exact vehicle is free before you book.`,
        link: { href: '/book', label: 'Check availability' },
      }
    }

    case 'lookup_booking': {
      const bookingNumber = extractBookingNumber(query)
      const rest = bookingNumber ? query.replace(bookingNumber, ' ') : query
      const phone = rest.match(/[+(]?\d[\d\s().-]{6,}\d/)?.[0]
      if (bookingNumber && phone) {
        try {
          const supabase = await createClient()
          const { data } = await supabase.rpc('get_reservation_by_booking', {
            p_booking_number: bookingNumber,
            p_phone: phone,
          })
          const row = Array.isArray(data) ? data[0] : null
          if (row) {
            const when = new Date(row.pickup_time).toLocaleString()
            return { text: `Booking ${row.booking_number}: status “${row.status}”, pickup ${when}, total $${row.total_price}.` }
          }
          return {
            text: `I couldn’t find a booking matching that number and phone. Double-check them, or manage it directly:`,
            link: { href: '/manage-booking', label: 'Manage my booking' },
          }
        } catch {
          /* fall through to the guided reply */
        }
      }
      return {
        text: `Sure — share your booking number (starts with PH…) and the phone on the reservation, and I’ll pull up the status.`,
        link: { href: '/manage-booking', label: 'Manage my booking' },
      }
    }

    case 'escalate':
    default: {
      // Rate-limit before persisting / paging: 5 escalations / hour / IP.
      // Prevents a script from filling support_requests and spamming Telegram/email.
      const rl = await checkRateLimit('chatbot.escalate', 5, 3600)
      if (!rl.ok) {
        return {
          text: `Our team has received your earlier messages — please give us a moment to follow up, or call ${HUMAN_PHONE}.`,
          link: { href: 'tel:' + HUMAN_PHONE.replace(/\D/g, ''), label: `Call ${HUMAN_PHONE}` },
        }
      }
      // Record for management (best-effort) and hand off to a human.
      try {
        const supabase = await createClient()
        await supabase.rpc('create_support_request', {
          p_kind: 'escalation',
          p_customer_name: null,
          p_customer_phone: null,
          p_customer_email: null,
          p_message: query.slice(0, 500),
          p_context: { source: 'chat' },
        })
      } catch {
        /* never block the reply on the notification */
      }
      // Best-effort real-time ping to management (in addition to the DB queue).
      await notifyManagement({ message: query.slice(0, 500) }).catch(() => {})
      return {
        text: `That one’s best handled by a person. Call or text our concierge anytime at ${HUMAN_PHONE} — I’ve also flagged your request to our team so they can follow up.`,
      }
    }
  }
}
