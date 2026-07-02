import { sendDriverDispatch } from '@/lib/email/sendDriverDispatch'
import { sendSms } from '@/lib/sms/notify'
import type { ManagerReservation } from '@/lib/manager/data'

export type ChauffeurContact = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notify_email: boolean
  notify_sms: boolean
}

type DispatchInput = {
  reservation: ManagerReservation
  chauffeur: ChauffeurContact
  vehicleName?: string | null
}

export type DispatchChannelResult = {
  attempted: boolean
  sent: boolean
  reason?: string
  to?: string
}

export type DispatchResult = {
  email: DispatchChannelResult
  sms: DispatchChannelResult
}

function channelIdle(reason: string): DispatchChannelResult {
  return { attempted: false, sent: false, reason }
}

/** Notify assigned driver via their preferred email and/or SMS. */
export async function notifyDriverDispatch(input: DispatchInput): Promise<DispatchResult> {
  const { reservation: r, chauffeur: c, vehicleName } = input
  const unitLabel = r.assigned_unit?.label ?? null
  const body =
    `Imperial Odyssey — Trip Assignment\n` +
    `Booking: ${r.booking_number}\n` +
    `Customer: ${r.customer_name}\n` +
    `Phone: ${r.customer_phone}\n` +
    `Pickup: ${r.pickup_address}\n` +
    `Time: ${new Date(r.pickup_time).toLocaleString('en-US')}\n` +
    `Drop-off: ${r.dropoff_address}\n` +
    `Vehicle: ${vehicleName ?? r.fleet?.name ?? 'TBD'}` +
    (unitLabel ? `\nUnit: ${unitLabel}` : '') +
    `\nPassengers: ${r.passengers}` +
    (r.luggage ? `\nLuggage: ${r.luggage}` : '') +
    (r.special_requests ? `\nNotes: ${r.special_requests}` : '') +
    `\nReply to: concierge@phalotrans.com`

  const result: DispatchResult = {
    email: channelIdle('email not configured'),
    sms: channelIdle('SMS not configured'),
  }

  if (c.notify_email) {
    const email = c.email?.trim() ?? ''
    if (!email) {
      result.email = { attempted: false, sent: false, reason: 'no email on file for chauffeur' }
    } else {
      const emailResult = await sendDriverDispatch({
        to: email,
        driverName: c.name,
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        customerPhone: r.customer_phone,
        bookingNumber: r.booking_number,
        pickupTime: r.pickup_time,
        pickupAddress: r.pickup_address,
        dropoffAddress: r.dropoff_address,
        vehicleName: vehicleName ?? r.fleet?.name,
        assignedUnitLabel: unitLabel,
        passengers: r.passengers,
        luggage: r.luggage,
        durationHours: r.duration_hours,
        distanceMiles: r.distance_miles,
        specialRequests: r.special_requests,
        totalPrice: Number(r.total_price),
        paymentStatus: r.payment_status,
        status: r.status,
      })
      result.email = {
        attempted: true,
        sent: emailResult.sent,
        reason: emailResult.reason,
        to: email,
      }
    }
  } else {
    result.email = { attempted: false, sent: false, reason: 'email notifications disabled for chauffeur' }
  }

  if (c.notify_sms && c.phone) {
    const smsResult = await sendSms({ to: c.phone, body })
    result.sms = {
      attempted: true,
      sent: smsResult.sent,
      reason: smsResult.reason,
      to: c.phone,
    }
  }

  if (!result.email.attempted && !result.sms.attempted) {
    console.warn('[dispatch] No contact channel for chauffeur', {
      chauffeur: c.name,
      reservation: r.booking_number,
      notifyEmail: c.notify_email,
      notifySms: c.notify_sms,
      hasEmail: Boolean(c.email),
      hasPhone: Boolean(c.phone),
    })
  }

  return result
}

/** Turn dispatch channel results into a user-facing error when nothing was delivered. */
export function dispatchDeliveryError(result: DispatchResult): string | null {
  const delivered = (result.email.sent ? 1 : 0) + (result.sms.sent ? 1 : 0)
  if (delivered > 0) return null

  if (result.email.attempted && !result.email.sent) {
    const detail = result.email.reason ?? 'unknown error'
    const to = result.email.to ? ` (${result.email.to})` : ''
    return `Driver email failed to send${to}: ${detail}`
  }

  if (!result.email.attempted && result.email.reason === 'no email on file for chauffeur') {
    return 'This chauffeur has no email on file. Add one under Manager → Fleet → Manage Chauffeurs.'
  }

  if (!result.email.attempted && result.email.reason === 'email notifications disabled for chauffeur') {
    return 'Email notifications are disabled for this chauffeur.'
  }

  if (result.sms.attempted && !result.sms.sent) {
    return `Driver SMS failed: ${result.sms.reason ?? 'unknown error'}`
  }

  return 'No dispatch channel available for this chauffeur. Add an email or phone number.'
}