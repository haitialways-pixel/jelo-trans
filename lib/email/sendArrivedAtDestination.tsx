import * as React from 'react'
import { sendTemplatedMail } from './mailer'
import { ArrivedAtDestinationEmail } from '@/lib/emails'
import { EMAIL_RE } from './format'

export type Input = {
  to: string
  customerName: string
  bookingNumber: string
}
export type EmailResult = { sent: boolean; reason?: string }

export async function sendArrivedAtDestination(i: Input): Promise<EmailResult> {
  if (!i.to || !EMAIL_RE.test(i.to)) return { sent: false, reason: 'invalid recipient email' }
  return sendTemplatedMail({
    to: i.to,
    fromKind: 'customer',
    subject: `You have arrived — Booking #${i.bookingNumber}`,
    react: (
      <ArrivedAtDestinationEmail
        customerName={i.customerName}
        bookingId={i.bookingNumber}
      />
    ),
  })
}
