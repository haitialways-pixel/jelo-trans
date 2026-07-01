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

/** Fire-and-forget lifecycle emails — must never block server actions. */
export function queueLifecycleEmails(input: SendInput): void {
  void sendLifecycleEmails(input).catch((e) => {
    console.error('[lifecycleEmails] background send failed:', e)
  })
}

async function sendLifecycleEmails({ stage, res, vehicleName, chauffeurContact }: SendInput) {
  if (!res.customer_email) return

  const common = {
    to: res.customer_email,
    customerName: res.customer_name,
    bookingNumber: res.booking_number,
    vehicleName,
    chauffeurName: res.chauffeur_name,
    chauffeurPhone: chauffeurContact?.phone ?? null,
  }

  switch (stage) {
    case 'confirm':
      await sendBookingConfirmation({
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
      break
    case 'dispatch':
      await sendChauffeurEnRoute({
        ...common,
        pickupAddress: res.pickup_address,
        pickupTime: res.pickup_time,
      })
      if (chauffeurContact) {
        await notifyDriverDispatch({ reservation: res, chauffeur: chauffeurContact, vehicleName })
      }
      break
    case 'arrive_pickup':
      await sendArrivedAtPickup(common)
      break
    case 'onboard':
      await sendPassengerOnBoard(common)
      break
    case 'arrive_dropoff':
      await sendArrivedAtDestination({
        to: common.to,
        customerName: common.customerName,
        bookingNumber: common.bookingNumber,
      })
      break
    case 'complete':
      await sendRideComplete({
        ...common,
        pickupAddress: res.pickup_address,
        dropoffAddress: res.dropoff_address,
        pickupTime: res.pickup_time,
        totalAmount: res.total_price != null ? Number(res.total_price) : null,
        transactionId: res.balance_intent_id ?? res.deposit_intent_id ?? null,
        paymentMethod: res.payment_status === 'paid' ? 'Card on file' : null,
        completedAt: res.completed_at ?? new Date().toISOString(),
      })
      break
    case 'cancel':
      await sendCancellation({
        to: common.to,
        customerName: common.customerName,
        bookingNumber: common.bookingNumber,
        cancellationReason: 'Cancelled by Phalo Transportation',
      })
      break
  }
}