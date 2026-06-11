'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation'
import { notifyManagement } from '@/lib/chatbot/notify'
import { isStripeConfigured, getStripe } from '@/lib/stripe/server'
import { createDepositForBooking } from '@/lib/stripe/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { recordOpsNotification } from '@/lib/manager/notifyOps'

export async function calculatePrice(data: {
  vehicleId: string
  distanceMiles: number
}) {
  try {
    const supabase = await createClient()

    const { data: vehicle, error } = await supabase
      .from('fleet')
      .select('id, name, base_price, price_per_mile')
      .eq('id', data.vehicleId)
      .single()

    if (error) {
      return { error: `Database error: ${error.message}` }
    }

    if (!vehicle) {
      return { error: 'Selected vehicle not found in the database' }
    }

    if (!vehicle.base_price || vehicle.base_price <= 0) {
      return { error: 'This vehicle does not have a valid rate configured' }
    }

    const base = Math.round((Number(vehicle.base_price) + (data.distanceMiles * Number(vehicle.price_per_mile))) * 100) / 100
    const gratuity = 0
    const total = base

    return {
      basePrice: base,
      gratuity,
      total,
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
    })

    if (error) {
      return { success: false, error: `Failed to create reservation: ${error.message}` }
    }

    revalidatePath('/manage-booking')

    // STRIPE ON: create the 10% deposit intent now and hand the client secret to the
    // browser (Elements). The confirmation email + management alert are DEFERRED to
    // finalizeDeposit(), i.e. only once the deposit is actually paid.
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
      } catch {
        return {
          success: false,
          error: 'Could not start the deposit payment. Please try again, or call us to book.',
        }
      }
    }

    // STRIPE OFF: confirm immediately (no online payment) — email + management alert now.
    let emailSent = false
    try {
      const { data: rows } = await supabase.rpc('get_reservation_by_booking', {
        p_booking_number: bookingNumber,
        p_phone: formData.customerPhone,
      })
      const canonical = Array.isArray(rows) ? rows[0] : null
      const res = await sendBookingConfirmation({
        to: formData.customerEmail,
        customerName: formData.customerName,
        bookingNumber,
        pickupTime: canonical?.pickup_time ?? formData.pickupTime,
        pickupAddress: formData.pickupAddress,
        vehicleName: formData.vehicleName,
        totalPrice: Number(canonical?.total_price ?? 0),
      })
      emailSent = res.sent
    } catch {
      emailSent = false
    }

    try {
      await notifyManagement({
        title: '🚗 New booking',
        message:
          `${formData.customerName} · ${bookingNumber}\n` +
          `${formData.pickupAddress} → ${formData.dropoffAddress}\n` +
          `Pickup: ${formData.pickupTime}\n` +
          `Vehicle: ${formData.vehicleName ?? '—'}`,
      })
    } catch {
      // ignore — the reservation is already created.
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
      const res = await sendBookingConfirmation({
        to: r.customer_email,
        customerName: r.customer_name,
        bookingNumber,
        pickupTime: r.pickup_time,
        pickupAddress: r.pickup_address,
        vehicleName,
        totalPrice: Number(r.total_price),
      })
      emailSent = res.sent
    } catch {
      emailSent = false
    }

    try {
      await notifyManagement({
        title: '🚗 New booking (deposit paid)',
        message:
          `${r.customer_name} · ${bookingNumber}\n` +
          `Deposit $${Number(r.deposit_amount ?? 0).toFixed(2)} paid · ` +
          `balance $${Number(r.balance_amount ?? 0).toFixed(2)} after ride`,
      })
    } catch {
      // ignore
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
