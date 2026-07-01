import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { DriverDispatchEmail } from '@/lib/emails'
import { fmtDate, fmtTime, EMAIL_RE } from './format'

export type DriverDispatchInput = {
  to: string
  driverName: string
  customerName: string
  bookingNumber: string
  pickupTime: string
  pickupAddress: string
  dropoffAddress: string
  vehicleName?: string | null
  passengers?: number
  specialRequests?: string | null
  totalPrice?: number | null
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendDriverDispatch(i: DriverDispatchInput): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) {
    console.warn('[email] sendDriverDispatch: invalid recipient', { bookingNumber: i.bookingNumber })
    return { sent: false, reason: 'invalid driver email' }
  }
  const result = await sendTemplatedMail({
    to: i.to,
    subject: `Trip assignment — Booking #${i.bookingNumber}`,
    react: (
      <DriverDispatchEmail
        driverName={i.driverName}
        customerName={i.customerName}
        bookingId={i.bookingNumber}
        pickupLocation={i.pickupAddress}
        dropoffLocation={i.dropoffAddress}
        pickupDate={fmtDate(i.pickupTime)}
        pickupTime={fmtTime(i.pickupTime)}
        vehicleType={i.vehicleName ?? undefined}
        passengerCount={i.passengers}
        specialRequests={i.specialRequests ?? undefined}
        totalAmount={i.totalPrice ?? undefined}
      />
    ),
  })
  if (!result.sent) {
    console.warn('[email] sendDriverDispatch failed:', result.reason, { bookingNumber: i.bookingNumber, to: i.to })
  } else {
    console.info('[email] Driver dispatch email sent', { bookingNumber: i.bookingNumber, to: i.to })
  }
  return result
}