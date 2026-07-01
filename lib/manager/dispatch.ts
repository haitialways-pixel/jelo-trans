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

/** Notify assigned driver via their preferred email and/or SMS. Best-effort. */
export async function notifyDriverDispatch(input: DispatchInput): Promise<void> {
  const { reservation: r, chauffeur: c, vehicleName } = input
  const body =
    `Phalo Transportation — Trip Assignment\n` +
    `Booking: ${r.booking_number}\n` +
    `Customer: ${r.customer_name}\n` +
    `Pickup: ${r.pickup_address}\n` +
    `Time: ${new Date(r.pickup_time).toLocaleString('en-US')}\n` +
    `Drop-off: ${r.dropoff_address}\n` +
    `Vehicle: ${vehicleName ?? r.fleet?.name ?? 'TBD'}\n` +
    `Passengers: ${r.passengers}` +
    (r.special_requests ? `\nNotes: ${r.special_requests}` : '')

  const tasks: Promise<unknown>[] = []

  if (c.notify_email && c.email) {
    tasks.push(
      sendDriverDispatch({
        to: c.email,
        driverName: c.name,
        customerName: r.customer_name,
        bookingNumber: r.booking_number,
        pickupTime: r.pickup_time,
        pickupAddress: r.pickup_address,
        dropoffAddress: r.dropoff_address,
        vehicleName: vehicleName ?? r.fleet?.name,
        passengers: r.passengers,
        specialRequests: r.special_requests,
        totalPrice: Number(r.total_price),
      }),
    )
  }

  if (c.notify_sms && c.phone) {
    tasks.push(sendSms({ to: c.phone, body }))
  }

  if (tasks.length === 0) {
    console.warn('[dispatch] No contact channel for chauffeur', { chauffeur: c.name, reservation: r.booking_number })
    return
  }

  await Promise.allSettled(tasks)
}