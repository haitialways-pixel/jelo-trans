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
      .select('id, name, base_price, price_per_mile, minimum_price, status')
      .eq('id', data.vehicleId)
      .eq('status', 'available')
      .maybeSingle()

    if (error) {
      console.error('[calculatePrice] fleet lookup failed:', error.message, { vehicleId: data.vehicleId })
      return {
        error:
          error.code === 'PGRST116'
            ? 'This vehicle is no longer available. Please refresh the page and choose again.'
            : `Could not load vehicle pricing (${error.message}). Please refresh and try again.`,
      }
    }

    if (!vehicle) {
      return {
        error:
          'This vehicle is no longer available. Please refresh the booking page and select a vehicle again.',
      }
    }

    if (!vehicle.base_price || vehicle.base_price <= 0) {
      return { error: 'This vehicle does not have a valid rate configured' }
    }

    // Pre-check time slot availability using the unit-aware RPC (prevents reaching confirm with a blocked slot)
    if (data.pickupTime && data.durationHours) {
      const start = new Date(data.pickupTime)
      const end = new Date(start.getTime() + (Number(data.durationHours) * 60 * 60 * 1000))
      const { data: available } = await supabase.rpc('check_vehicle_availability', {
        p_vehicle_id: data.vehicleId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      })
      if (!available) {
        return { error: 'This vehicle is no longer available for the selected time' }
      }
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
    // Rate-limit: 5 bookings/hour/IP. Stops a script from spamming reservations
    // and locking up the fleet's availability with junk holds.
    const rl = await checkRateLimit('booking.create', 5, 3600)
    if (!rl.ok) {
      return {
        success: false,
        error: 'Too many booking attempts. Please wait a few minutes, or call us directly.',
      }
    }

    const supabase = await createClient()

    // All validation, the authoritative price, and the availability check happen
    // inside create_reservation() (SECURITY DEFINER). The client total is never trusted.
    const gratuityPercent = isValidGratuityPercent(Number(formData.gratuityPercent))
      ? Number(formData.gratuityPercent)
      : DEFAULT_GRATUITY_PERCENT

    const { data: bookingNumber, error } = await supabase.rpc('create_reservation', {
      p_customer_name: formData.customerName,
      p_customer_email: formData.customerEmail,
      p_customer_phone: formData.customerPhone,
      p_pickup_address: formData.pickupAddress,
      p_dropoff_address: formData.dropoffAddress,
      p_pickup_time: formData.pickupTime,
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
      if (msg.includes('not available')) {
        return { success: false, error: msg }
      }
      return { success: false, error: `Failed to create reservation: ${msg}` }
    }

    revalidatePath('/manage-booking')

    // Alert ops immediately by email (even if deposit not paid yet). Customer confirmation
    // email still waits for manager review; "booking received" may follow deposit payment.
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
        }
      } catch (e) {
        console.error(`[createReservation] createDepositForBooking failed for ${bookingNumber}:`, e)
        // Reservation row exists (created by RPC). Return it so the customer has a reference number
        // even though online deposit setup failed. Manager received the internal notification.
        return {
          success: true,
          bookingNumber,
          requiresPayment: false,
          emailSent: false,
          error: 'Could not start the deposit payment. Please try again, or call us to book.',
        }
      }
    }

    // STRIPE OFF: send "booking received" to customer + alert management (confirmation comes after manager review).
    let emailSent = false
    try {
      const { data: rows } = await supabase.rpc('get_reservation_by_booking', {
        p_booking_number: bookingNumber,
        p_phone: formData.customerPhone,
      })
      const canonical = Array.isArray(rows) ? rows[0] : null
      const res = await sendBookingReceived({
        to: formData.customerEmail,
        customerName: formData.customerName,
        bookingNumber,
        pickupTime: canonical?.pickup_time ?? formData.pickupTime,
        pickupAddress: formData.pickupAddress,
        dropoffAddress: formData.dropoffAddress,
        vehicleName: formData.vehicleName,
        totalPrice: Number(canonical?.total_price ?? 0),
      })
      emailSent = res.sent
    } catch (e) {
      console.error('[createReservation] booking received email failed:', e)
      emailSent = false
    }

    return { success: true, bookingNumber, requiresPayment: false, emailSent }
  } catch {
    return { success: false, error: 'Server error while creating reservation. Please try again.' }
  }
}

/**
 * Verifies the deposit PaymentIntent succeeded (called after Elements confirms on the
 * client), records it on the reservation, and THEN sends the confirmation email +
 * management alert. This makes the flow work locally without a webhook; the webhook is
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

    const vehicleName = (r as unknown as { fleet?: { name?: string } }).fleet?.name

    let emailSent = false
    try {
      const res = await sendBookingReceived({
        to: r.customer_email,
        customerName: r.customer_name,
        bookingNumber,
        pickupTime: r.pickup_time,
        pickupAddress: r.pickup_address,
        dropoffAddress: r.dropoff_address,
        vehicleName,
        totalPrice: Number(r.total_price),
      })
      emailSent = res.sent
    } catch (e) {
      console.error('[finalizeDeposit] booking received email failed:', e)
      emailSent = false
    }

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
      emailSent,
      depositAmount: Number(r.deposit_amount ?? 0),
      balanceAmount: Number(r.balance_amount ?? 0),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not finalize the payment' }
  }
}
