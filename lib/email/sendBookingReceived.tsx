import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { BookingReceivedEmail } from '@/lib/emails'
import { fmtDate, fmtTime, EMAIL_RE } from './format'

export type BookingReceivedInput = {
  to: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress?: string
  vehicleName?: string
  totalPrice: number
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendBookingReceived(i: BookingReceivedInput): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) {
    console.warn('[email] sendBookingReceived: invalid recipient', { bookingNumber: i.bookingNumber })
    return { sent: false, reason: 'invalid recipient email' }
  }
  const result = await sendTemplatedMail({
    to: i.to,
    subject: `We received your Phalo Transportation booking #${i.bookingNumber}`,
    react: (
      <BookingReceivedEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        pickupLocation={i.pickupAddress}
        dropoffLocation={i.dropoffAddress}
        pickupDate={fmtDate(i.pickupTime)}
        pickupTime={fmtTime(i.pickupTime)}
        vehicleType={i.vehicleName}
        totalAmount={i.totalPrice}
      />
    ),
  })
  if (!result.sent) {
    console.warn('[email] sendBookingReceived failed:', result.reason, { bookingNumber: i.bookingNumber, to: i.to })
  } else {
    console.info('[email] Booking received email sent', { bookingNumber: i.bookingNumber, to: i.to })
  }
  return result
}