import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { ChauffeurEnRouteEmail } from '@/lib/emails'
import { fmtTime, EMAIL_RE } from './format'

export type Input = {
  to: string
  customerName: string
  bookingNumber: string
  pickupAddress: string
  pickupTime: string
  vehicleName?: string | null
  chauffeurName?: string | null
  chauffeurPhone?: string | null
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendChauffeurEnRoute(i: Input): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    subject: `Your driver is on the way — Booking #${i.bookingNumber}`,
    react: (
      <ChauffeurEnRouteEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        pickupLocation={i.pickupAddress}
        pickupTime={fmtTime(i.pickupTime)}
        vehicleType={i.vehicleName ?? undefined}
        driverName={i.chauffeurName ?? undefined}
        driverPhone={i.chauffeurPhone ?? undefined}
      />
    ),
  })
}
