import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { ArrivedAtPickupEmail } from '@/lib/emails'
import { EMAIL_RE } from './format'

export type Input = {
  to: string
  customerName: string
  bookingNumber: string
  vehicleName?: string | null
  chauffeurName?: string | null
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendArrivedAtPickup(i: Input): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    subject: `Your driver has arrived — Booking #${i.bookingNumber}`,
    react: (
      <ArrivedAtPickupEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        vehicleType={i.vehicleName ?? undefined}
        driverName={i.chauffeurName ?? undefined}
      />
    ),
  })
}
