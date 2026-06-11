import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { BookingConfirmedEmail } from '@/lib/emails'
import { fmtDate, fmtTime, EMAIL_RE } from './format'

export type BookingEmailInput = {
  to: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  vehicleName?: string
  totalPrice: number
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendBookingConfirmation(i: BookingEmailInput): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    subject: `Your Phalo Transportation booking #${i.bookingNumber} is confirmed`,
    react: (
      <BookingConfirmedEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        pickupLocation={i.pickupAddress}
        pickupDate={fmtDate(i.pickupTime)}
        pickupTime={fmtTime(i.pickupTime)}
        vehicleType={i.vehicleName}
        totalAmount={i.totalPrice}
      />
    ),
  })
}
