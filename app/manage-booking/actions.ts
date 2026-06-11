'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { sendCancellation } from '@/lib/email/sendCancellation'

export async function getBooking(bookingNumber: string, phone: string) {
  // Anti-brute-force: 10 lookups/min/IP. Even with a 32^6 booking code, an
  // attacker who already knows a customer's phone could try to guess. We cap it.
  const rl = await checkRateLimit('booking.lookup', 10, 60)
  if (!rl.ok) {
    return { success: false, error: 'Too many lookup attempts. Please wait a moment.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_reservation_by_booking', {
    p_booking_number: bookingNumber,
    p_phone: phone,
  })

  if (error || !data || data.length === 0) {
    return { success: false, error: 'Booking not found. Please check the number and phone.' }
  }

  return { success: true, data: data[0] }
}

export async function cancelBooking(bookingNumber: string, phone: string) {
  // 10 cancel attempts/min/IP (same envelope as lookup — same brute-force surface).
  const rl = await checkRateLimit('booking.cancel', 10, 60)
  if (!rl.ok) {
    return { success: false, error: 'Too many attempts. Please wait a moment.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('cancel_guest_reservation', {
    p_booking_number: bookingNumber,
    p_phone: phone,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Best-effort cancellation email to the customer.
  try {
    const row = Array.isArray(data) ? data[0] : data
    if (row?.customer_email && row?.customer_name && row?.booking_number) {
      await sendCancellation({
        to: row.customer_email,
        customerName: row.customer_name,
        bookingNumber: row.booking_number,
        cancellationReason: 'Cancelled at customer request',
      })
    }
  } catch {
    /* never block the cancellation on a failed email */
  }

  return { success: true, data }
}
