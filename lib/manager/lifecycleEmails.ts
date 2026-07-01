import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation'
import { sendChauffeurEnRoute } from '@/lib/email/sendChauffeurEnRoute'
import { sendArrivedAtPickup } from '@/lib/email/sendArrivedAtPickup'
import { sendPassengerOnBoard } from '@/lib/email/sendPassengerOnBoard'
import { sendArrivedAtDestination } from '@/lib/email/sendArrivedAtDestination'
import { sendRideComplete } from '@/lib/email/sendRideComplete'
import { sendCancellation } from '@/lib/email/sendCancellation'
import { notifyDriverDispatch } from '@/lib/manager/dispatch'
import type { Chauffeur, ManagerReservation } from '@/lib/manager/data'

type LifecycleStage =
  | 'confirm'
  | 'dispatch'
  | 'arrive_pickup'
  | 'onboard'
  | 'arrive_dropoff'
  | 'complete'
  | 'cancel'

type SendInput = {
  stage: LifecycleStage
  res: ManagerReservation
  vehicleName: string | null
  chauffeurContact: Chauffeur | null
}

export type LifecycleEmailResult = { sent: boolean; reason?: string }

/**
 * Send lifecycle email for a reservation stage.
 * Must be awaited in server actions — Vercel terminates the function after the
 * response if this is fire-and-forget.
 */
export async function sendLifecycleEmails({
  stage,
  res,
  vehicleName,
  chauffeurContact,
}: SendInput): Promise<LifecycleEmailResult> {
  if (!res.customer_email?.trim()) {
    console.warn('[lifecycleEmails] no customer email', { bookingNumber: res.booking_number, stage })
    return { sent: false, reason: 'no customer email on reservation' }
  }

  const common = {
    to: res.customer_email.trim(),
    customerName: res.customer_name,
    bookingNumber: res.booking_number,
    vehicleName,
    chauffeurName: res.chauffeur_name,
    chauffeurPhone: chauffeurContact?.phone ?? null,
  }

  switch (stage) {
    case 'confirm':
      return sendBookingConfirmation({
        to: common.to,
        customerName: common.customerName,
        bookingNumber: common.bookingNumber,
        pickupTime: res.pickup_time,
        pickupAddress: res.pickup_address,
        dropoffAddress: res.dropoff_address,
        vehicleName: vehicleName ?? undefined,
        chauffeurName: common.chauffeurName,
        chauffeurPhone: common.chauffeurPhone,
        totalPrice: Number(res.total_price),
      })
    case 'dispatch': {
      const enRoute = await sendChauffeurEnRoute({
        ...common,
        pickupAddress: res.pickup_address,
        pickupTime: res.pickup_time,
      })
      if (chauffeurContact) {
        const dispatchResult = await notifyDriverDispatch({
          reservation: res,
          chauffeur: chauffeurContact,
          vehicleName,
        })
        if (!dispatchResult.email.sent && !dispatchResult.sms.sent) {
          console.warn('[lifecycleEmails] driver dispatch not delivered:', dispatchResult)
        }
      }
      return enRoute
    }
    case 'arrive_pickup':
      return sendArrivedAtPickup(common)
    case 'onboard':
      return sendPassengerOnBoard(common)
    case 'arrive_dropoff':
      return sendArrivedAtDestination({
        to: common.to,
        customerName: common.customerName,
        bookingNumber: common.bookingNumber,
      })
    case 'complete':
      return sendRideComplete({
        ...common,
        pickupAddress: res.pickup_address,
        dropoffAddress: res.dropoff_address,
        pickupTime: res.pickup_time,
        totalAmount: res.total_price != null ? Number(res.total_price) : null,
        transactionId: res.balance_intent_id ?? res.deposit_intent_id ?? null,
        paymentMethod: res.payment_status === 'paid' ? 'Card on file' : null,
        completedAt: res.completed_at ?? new Date().toISOString(),
      })
    case 'cancel':
      return sendCancellation({
        to: common.to,
        customerName: common.customerName,
        bookingNumber: common.bookingNumber,
        cancellationReason: 'Cancelled by Phalo Transportation',
      })
    default:
      return { sent: false, reason: `unknown stage: ${stage}` }
  }
}