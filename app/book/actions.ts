'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendBookingReceived } from '@/lib/email/sendBookingReceived'
import { notifyManagement } from '@/lib/chatbot/notify'
import { isStripeConfigured, getStripe } from '@/lib/stripe/server'
import { createDepositForBooking } from '@/lib/stripe/payments'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { recordOpsNotification } from '@/lib/manager/notifyOps'
import {
  getManagerPendingReservationsUrl,
  getManagerReservationUrl,
} from '@/lib/site'
import {
  computeTripPrice,
  DEFAULT_GRATUITY_PERCENT,
  isValidGratuityPercent,
} from '@/lib/pricing'
import {
  isPickupIsoValid,
  pickupLocalToIsoWithOffset,
  pickupTimeValidationMessage,
} from '@/lib/booking/pickupTime'

async function sendCustomerBookingReceived(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingNumber: string,
  formData: {
    customerEmail: string
    customerName: string
    customerPhone: string
    pickupTime: string
    pickupAddress: string
    dropoffAddress?: string
    vehicleName?: string
  },
) {
  try {
    const { data: rows } = await supabase.rpc('get_reservation_by_booking', {
      p_booking_number: bookingNumber,
      p_phone: formData.customerPhone,
    })
    const canonical = Array.isArray(rows) ? rows[0] : null
    return await sendBookingReceived({
      to: formData.customerEmail,
      customerName: formData.customerName,
      bookingNumber,
      pickupTime: canonical?.pickup_time ?? formData.pickupTime,
      pickupAddress: formData.pickupAddress,
      dropoffAddress: formData.dropoffAddress,
      vehicleName: formData.vehicleName,
      totalPrice: Number(canonical?.total_price ?? 0),
    })
  } catch (e) {
    console.error('[createReservation] booking received email failed:', e)
    return { sent: false, reason: e instanceof Error ? e.message : 'send failed' }
  }
}

async function managerReservationLink(bookingNumber: string) {
  try {
    if (isAdminConfigured()) {
      const admin = createAdminClient()
      const { data } = await admin
        .from('reservations')
        .select('id')
        .eq('booking_number', bookingNumber)
        .maybeSingle()
      if (data?.id) {
        return {
          actionUrl: getManagerReservationUrl(data.id),
          actionLabel: 'Review pending reservation',
        }
      }
    }
  } catch (e) {
    console.warn('[booking] could not resolve reservation link:', e)
  }

  return {
    actionUrl: getManagerPendingReservationsUrl(),
    actionLabel: 'View pending reservations',
  }
}

export async function calculatePrice(data: {
  vehicleId: string
  distanceMiles: number
  pickupTime?: string
  durationHours?: number
  gratuityPercent?: number
}) {
  try {
    const supabase = await createClient()
    const gratuityPercent = isValidGratuityPercent(Number(data.gratuityPercent))
      ? Number(data.gratuityPercent)
      : DEFAULT_GRATUITY_PERCENT

    if (!data.vehicleId?.trim()) {
      return { error: 'Please select a vehicle before continuing.' }
    }

    const { data: vehicle, error } = await supabase
      .from('fleet')
      .select('id, name, base_price, price_per_mile, minimum_price')
      .eq('id', data.vehicleId)
      .maybeSingle()

    if (error) {
      console.error('[calculatePrice] fleet lookup failed:', error.message, { vehicleId: data.vehicleId })
      return { error: `Could not load vehicle pricing. Please refresh and try again.` }
    }

    if (!vehicle) {
      return { error: 'Selected vehicle not found. Please refresh the page and choose again.' }
    }

    if (!vehicle.base_price || vehicle.base_price <= 0) {
      return { error: 'This vehicle does not have a valid rate configured' }
    }

    const priced = computeTripPrice({
      basePrice: Number(vehicle.base_price),
      pricePerMile: Number(vehicle.price_per_mile),
      distanceMiles: Number(data.distanceMiles || 0),
      minimumPrice: Number(vehicle.minimum_price ?? 0),
      gratuityPercent,
    })

    return {
      basePrice: priced.fareSubtotal,
      gratuityPercent: priced.gratuityPercent,
      gratuityAmount: priced.gratuityAmount,
      total: priced.total,
      vehicleName: vehicle.name,
    }
  } catch {
    return { error: 'Something went wrong while calculating price. Please try again.' }
  }
}

export async function createReservation(formData: any) {
  try {
    const supabase = await createClient()

    const gratuityPercent = isValidGratuityPercent(Number(formData.gratuityPercent))
      ? Number(formData.gratuityPercent)
      : DEFAULT_GRATUITY_PERCENT

    // Prefer ISO from the browser (correct timezone). Fallback uses client offset when provided.
    let pickupIso: string | null =
      typeof formData.pickupTimeIso === 'string' && formData.pickupTimeIso.trim()
        ? formData.pickupTimeIso.trim()
        : null

    if (!pickupIso && formData.pickupTime) {
      const offset =
        typeof formData.pickupTimezoneOffset === 'number'
          ? formData.pickupTimezoneOffset
          : null
      if (offset != null) {
        pickupIso = pickupLocalToIsoWithOffset(formData.pickupTime, offset)
      }
    }

    if (!pickupIso) {
      return { success: false, error: 'Please enter a valid pickup date and time.' }
    }

    if (!isPickupIsoValid(pickupIso)) {
      return { success: false, error: pickupTimeValidationMessage() }
    }

    // Rate-limit successful bookings only — failed attempts (timing, etc.) don't count.
    const rl = await checkRateLimit('booking.create', 30, 3600, undefined, false)
    if (!rl.ok) {
      return {
        success: false,
        error: 'Too many bookings from this device. Please wait a few minutes, or call us directly.',
      }
    }

    const { data: bookingNumber, error } = await supabase.rpc('create_reservation', {
      p_customer_name: formData.customerName,
      p_customer_email: formData.customerEmail,
      p_customer_phone: formData.customerPhone,
      p_pickup_address: formData.pickupAddress,
      p_dropoff_address: formData.dropoffAddress,
      p_pickup_time: pickupIso,
      p_vehicle_id: formData.vehicleId,
      p_passengers: parseInt(formData.passengers) || 2,
      p_luggage: parseInt(formData.luggage) || 0,
      p_duration_hours: Number(formData.durationHours) || 3,
      p_special_requests: formData.specialRequests || null,
      p_distance_miles: Number(formData.distanceMiles) || 0,
      p_gratuity_percent: gratuityPercent,
    })

    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('Gratuity must be')) {
        return { success: false, error: msg }
      }
      if (msg.includes('create_reservation') || msg.includes('p_gratuity_percent')) {
        return {
          success: false,
          error:
            'Booking system needs a database update (gratuity migration). Please call us to book, or ask your administrator to run supabase/migrations/20260702_gratuity.sql.',
        }
      }
      if (
        msg.includes('15 minutes') ||
        msg.includes('in the future') ||
        msg.toLowerCase().includes('pickup')
      ) {
        return { success: false, error: pickupTimeValidationMessage() }
      }
      return { success: false, error: `Failed to create reservation: ${msg}` }
    }

    await checkRateLimit('booking.create', 30, 3600, undefined, true)

    revalidatePath('/manage-booking')

    // Alert ops + customer immediately (even before deposit). Manager approval email follows later.
    try {
      const link = await managerReservationLink(bookingNumber)
      await notifyManagement({
        alwaysEmail: true,
        title: '🚗 New online booking (pending review)',
        message:
          `${formData.customerName} · ${bookingNumber}\n` +
          `${formData.pickupAddress} → ${formData.dropoffAddress}\n` +
          `Pickup: ${formData.pickupTime}\n` +
          `Vehicle: ${formData.vehicleName ?? '—'}\n` +
          `Phone: ${formData.customerPhone}\n` +
          `Customer email: ${formData.customerEmail}\n` +
          `Gratuity: ${gratuityPercent}%\n` +
          (isStripeConfigured() ? 'Deposit: not paid yet' : 'Deposit: Stripe not configured'),
        ...link,
      })
    } catch (e) {
      console.error('[createReservation] management notification failed:', e)
    }

    const customerEmail = await sendCustomerBookingReceived(supabase, bookingNumber, formData)
    const emailSent = customerEmail.sent
    if (!emailSent) {
      console.warn('[createReservation] customer booking received email not sent:', customerEmail.reason, {
        bookingNumber,
        to: formData.customerEmail,
      })
    }

    // STRIPE ON: create the 10% deposit intent and hand the client secret to the browser.
    if (isStripeConfigured()) {
      try {
        const dep = await createDepositForBooking(bookingNumber)
        return {
          success: true,
          bookingNumber,
          requiresPayment: true,
          clientSecret: dep.clientSecret,
          depositAmount: dep.depositAmount,
          balanceAmount: dep.balanceAmount,
          emailSent,
          emailError: emailSent ? undefined : customerEmail.reason,
        }
      } catch (e) {
        console.error(`[createReservation] createDepositForBooking failed for ${bookingNumber}:`, e)
        return {
          success: true,
          bookingNumber,
          requiresPayment: false,
          emailSent,
          emailError: emailSent ? undefined : customerEmail.reason,
          error: 'Could not start the deposit payment. Please try again, or call us to book.',
        }
      }
    }

    return { success: true, bookingNumber, requiresPayment: false, emailSent, emailError: emailSent ? undefined : customerEmail.reason }
  } catch {
    return { success: false, error: 'Server error while creating reservation. Please try again.' }
  }
}

/**
 * Verifies the deposit PaymentIntent succeeded (called after Elements confirms on the
 * client), records it on the reservation, and alerts management. Customer "booking received"
 * email is sent at reservation creation. This makes the flow work locally without a webhook; the webhook is
 * the production backstop. Idempotent.
 */
export async function finalizeDeposit(bookingNumber: string) {
  try {
    const admin = createAdminClient()
    const { data: r, error } = await admin
      .from('reservations')
      .select(
        'id, customer_name, customer_email, pickup_time, pickup_address, dropoff_address, total_price, deposit_intent_id, deposit_amount, balance_amount, deposit_paid_at, fleet:vehicle_id (name)',
      )
      .eq('booking_number', bookingNumber)
      .single()
    if (error || !r) return { ok: false, error: 'Reservation not found' }
    if (r.deposit_paid_at) {
      return { ok: true, depositAmount: Number(r.deposit_amount ?? 0), balanceAmount: Number(r.balance_amount ?? 0) }
    }
    if (!r.deposit_intent_id) return { ok: false, error: 'No deposit on this booking' }

    const pi = await getStripe().paymentIntents.retrieve(r.deposit_intent_id)
    if (pi.status !== 'succeeded') return { ok: false, error: 'Payment not completed yet' }

    const pmId =
      typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method?.id ?? null)

    await admin
      .from('reservations')
      .update({
        deposit_paid_at: new Date().toISOString(),
        payment_status: 'partial',
        stripe_payment_method_id: pmId,
      })
      .eq('id', r.id)

    await recordOpsNotification({
      kind: 'deposit_paid',
      title: '💳 Deposit paid · ' + bookingNumber,
      body: r.customer_name + ' · $' + Number(r.deposit_amount ?? 0).toFixed(2),
      reservationId: r.id,
      severity: 'info',
    })

    try {
      await notifyManagement({
        alwaysEmail: true,
        title: '💳 Deposit paid — ' + bookingNumber,
        message:
          `${r.customer_name} · ${bookingNumber}\n` +
          `Deposit $${Number(r.deposit_amount ?? 0).toFixed(2)} paid · ` +
          `balance $${Number(r.balance_amount ?? 0).toFixed(2)} after ride\n` +
          `Customer email: ${r.customer_email}`,
        actionUrl: getManagerReservationUrl(r.id),
        actionLabel: 'Open reservation in manager portal',
      })
    } catch (e) {
      console.error('[finalizeDeposit] management notification failed:', e)
    }

    return {
      ok: true,
      depositAmount: Number(r.deposit_amount ?? 0),
      balanceAmount: Number(r.balance_amount ?? 0),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not finalize the payment' }
  }
}
