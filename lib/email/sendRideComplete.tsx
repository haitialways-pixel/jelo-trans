import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { RideCompletedEmail } from '@/lib/emails'
import { fmtDate, EMAIL_RE } from './format'

export type Input = {
  to: string
  customerName: string
  bookingNumber: string
  pickupAddress?: string | null
  dropoffAddress?: string | null
  pickupTime?: string | null
  vehicleName?: string | null
  chauffeurName?: string | null
  totalAmount?: number | null
  paymentMethod?: string | null
  transactionId?: string | null
  completedAt?: string | null
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendRideComplete(i: Input): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    subject: `Thank you for riding with Phalo Transportation — Booking #${i.bookingNumber}`,
    react: (
      <RideCompletedEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        pickupDate={i.pickupTime ? fmtDate(i.pickupTime) : undefined}
        pickupLocation={i.pickupAddress ?? undefined}
        dropoffLocation={i.dropoffAddress ?? undefined}
        vehicleType={i.vehicleName ?? undefined}
        driverName={i.chauffeurName ?? undefined}
        totalAmount={i.totalAmount ?? undefined}
        paymentMethod={i.paymentMethod ?? undefined}
        transactionId={i.transactionId ?? undefined}
        completionDate={i.completedAt ? fmtDate(i.completedAt) : undefined}
      />
    ),
  })
}
